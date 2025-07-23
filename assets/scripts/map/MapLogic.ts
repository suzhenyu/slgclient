import { _decorator, Component, TiledMap, Camera, Node, Vec2, Event, game, UITransform, EventMouse, EventTouch, Vec3, view } from 'cc';
const { ccclass, property } = _decorator;

import MapCommand from "./MapCommand";
import MapUtil from "./MapUtil";
import { EventMgr } from '../utils/EventMgr';
import { LogicEvent } from '../common/LogicEvent';

/**
 * 地图逻辑控制器
 * 负责处理地图的用户交互、相机控制、缩放、移动等功能
 * 主要功能包括：
 * 1. 地图触摸交互（点击、拖拽、缩放）
 * 2. 相机位置和缩放控制
 * 3. 地图边界限制
 * 4. 坐标系转换
 * 5. 地图裁剪优化
 */
@ccclass('MapLogic')
export default class MapLogic extends Component {
    /** 地图命令管理器实例 */
    protected _cmd: MapCommand;

    /** 瓦片地图组件引用 */
    protected _tiledMap: TiledMap = null;

    /** 地图相机组件引用 */
    protected _mapCamera: Camera = null;

    /** 是否正在触摸状态 */
    protected _isTouch: boolean = false;

    /** 是否正在移动状态 */
    protected _isMove: boolean = false;

    /** 地图相机最小缩放倍率（最远视角） */
    protected _minZoomRatio: number = 1;

    /** 地图相机最大缩放倍率（最近视角） */
    protected _maxZoomRatio: number = 0.8;

    /** 鼠标滚轮缩放变化基数 */
    protected _changeZoomRadix: number = 200;

    /** 相机正交高度基准值 */
    protected _orthoHeight: number = 360;

    /** 地图相机X轴移动边界最大值 */
    protected _maxMapX: number = 1;

    /** 地图相机Y轴移动边界最大值 */
    protected _maxMapY: number = 1;

    /** 触摸动画节点（暂未使用） */
    protected _touchAniNode: Node = null;

    /** 中心点坐标（暂未使用） */
    protected _centerPoint: Vec2 = null;

    /**
     * 组件加载时的初始化方法
     * 设置地图命令管理器、相机引用、事件监听等
     */
    protected onLoad(): void {
        console.log("MapLogic onLoad");

        // 获取地图命令管理器单例
        this._cmd = MapCommand.getInstance();

        // 获取地图相机组件
        this._mapCamera = this.node.parent.getChildByName("Map Camera").getComponent(Camera);

        // 保存相机初始正交高度
        this._orthoHeight = this._mapCamera.orthoHeight;

        // 注册城市相关事件监听
        EventMgr.on(LogicEvent.openCityAbout, this.openCityAbout, this);
        EventMgr.on(LogicEvent.closeCityAbout, this.closeCityAbout, this);
    }

    /**
     * 组件销毁时的清理方法
     * 移除事件监听，清理引用
     */
    protected onDestroy(): void {
        // 移除所有以当前对象为目标的事件监听
        EventMgr.targetOff(this);

        // 清理命令管理器引用
        this._cmd = null;
    }

    /**
     * 设置瓦片地图并初始化相关配置
     * @param tiledMap 瓦片地图组件
     */
    public setTiledMap(tiledMap: TiledMap): void {
        this._tiledMap = tiledMap;

        // 启用地图裁剪优化，只渲染可见区域
        this._tiledMap.enableCulling = true;

        // 更新裁剪区域
        this.updateCulling();

        // 计算地图移动边界
        var uit = this._tiledMap.node.getComponent(UITransform);
        this._maxMapX = (uit.width - view.getVisibleSize().width) * 0.5;
        this._maxMapY = (uit.height - view.getVisibleSize().height) * 0.5;

        // 注册地图节点的各种交互事件
        this._tiledMap.node.on(Node.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
        this._tiledMap.node.on(Node.EventType.TOUCH_START, this.onTouchBegan, this);
        this._tiledMap.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this._tiledMap.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this._tiledMap.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    /**
     * 打开城市详情时的处理
     * 将相机缩放到最大倍率（最近视角）
     * @param data 城市数据
     */
    protected openCityAbout(data: any): void {
        this._mapCamera.orthoHeight = this._orthoHeight * this._maxZoomRatio;
    }

    /**
     * 关闭城市详情时的处理
     * 将相机缩放恢复到最小倍率（最远视角）
     */
    protected closeCityAbout(): void {
        this._mapCamera.orthoHeight = this._orthoHeight * this._minZoomRatio;
    }

    /**
     * 鼠标滚轮事件处理
     * 根据滚轮方向调整地图缩放级别
     * @param event 鼠标事件对象
     */
    protected onMouseWheel(event: EventMouse): void {
        console.log("onMouseWheel");

        // 获取滚轮滚动的Y轴偏移量
        let scrollY: number = event.getScrollY();

        // 计算缩放变化比例
        let changeRatio: number = Number((scrollY / this._changeZoomRadix).toFixed(1));

        // 计算新的缩放比例，并限制在最小和最大缩放范围内
        let newZoomRatio: number = Math.min(this._minZoomRatio, Math.max(this._maxZoomRatio, this._mapCamera.orthoHeight / this._orthoHeight + changeRatio));

        console.log("onMouseWheel:", newZoomRatio);

        // 应用新的缩放比例
        this._mapCamera.orthoHeight = this._orthoHeight * newZoomRatio;
    }

    /**
     * 触摸移动事件处理
     * 根据触摸偏移量移动地图相机位置
     * @param event 触摸事件对象
     */
    protected onTouchMove(event: EventTouch): void {
        if (this._isTouch) {
            // 获取触摸偏移量
            let delta: Vec2 = event.getDelta();

            if (delta.x != 0 || delta.y != 0) {
                // 标记为移动状态
                this._isMove = true;

                // 计算新的相机位置
                let pixelPoint: Vec2 = new Vec2(0, 0);
                pixelPoint.x = this._mapCamera.node.position.x - delta.x;
                pixelPoint.y = this._mapCamera.node.position.y - delta.y;

                // 限制相机位置在地图边界内
                pixelPoint.x = Math.min(this._maxMapX, Math.max(-this._maxMapX, pixelPoint.x));
                pixelPoint.y = Math.min(this._maxMapY, Math.max(-this._maxMapY, pixelPoint.y));

                // 应用新的相机位置
                this._mapCamera.node.setPosition(new Vec3(pixelPoint.x, pixelPoint.y, this._mapCamera.node.position.z));

                // 更新中心点坐标
                this.setCenterMapCellPoint(MapUtil.mapPixelToCellPoint(pixelPoint), pixelPoint);

                // 更新地图裁剪区域
                this.updateCulling();
            }
        }
    }

    /**
     * 触摸开始事件处理
     * 初始化触摸状态
     * @param event 触摸事件对象
     */
    protected onTouchBegan(event: EventTouch): void {
        this._isTouch = true;
        this._isMove = false;
    }

    /**
     * 触摸结束事件处理
     * 根据是否发生移动来判断是点击还是拖拽操作
     * @param event 触摸事件对象
     */
    protected onTouchEnd(event: EventTouch): void {
        this._isTouch = false;

        if (this._isMove == false) {
            // 如果没有移动，则认为是点击操作
            let touchLocation: Vec2 = event.touch.getUILocation();
            let touchLocation1 = this.viewPointToWorldPoint(touchLocation);
            let mapPoint: Vec2 = MapUtil.worldPixelToMapCellPoint(touchLocation1);
            let clickCenterPoint: Vec2 = MapUtil.mapCellToPixelPoint(mapPoint);

            // 派发地图点击事件
            EventMgr.emit(LogicEvent.touchMap, mapPoint, clickCenterPoint);
        } else {
            // 如果发生了移动，则派发地图移动事件
            EventMgr.emit(LogicEvent.moveMap);
        }

        this._isMove = false;
    }

    /**
     * 触摸取消事件处理
     * 重置触摸状态
     * @param event 触摸事件对象
     */
    protected onTouchCancel(event: EventTouch): void {
        this._isTouch = false;
        this._isMove = false;
    }

    /**
     * 将界面坐标转换为世界坐标
     * @param point 界面坐标点
     * @returns 世界坐标点
     */
    protected viewPointToWorldPoint(point: Vec2): Vec2 {
        // 获取画布节点和地图节点的UI变换组件
        let canvasNode: Node = this.node.parent;
        let cuit = canvasNode.getComponent(UITransform);
        let uit = this._tiledMap.node.getComponent(UITransform);

        // 计算相机在世界坐标系中的位置
        let cameraWorldX: number = uit.width * uit.anchorX - view.getVisibleSize().width * cuit.anchorX + this._mapCamera.node.position.x;
        let cameraWorldY: number = uit.height * uit.anchorY - view.getVisibleSize().height * cuit.anchorY + this._mapCamera.node.position.y;

        // 返回转换后的世界坐标
        return new Vec2(point.x + cameraWorldX, point.y + cameraWorldY);
    }

    /**
     * 将世界坐标转换为相对地图的像素坐标
     * @param point 世界坐标点
     * @returns 地图像素坐标点
     */
    protected worldToMapPixelPoint(point: Vec2): Vec2 {
        var uit = this._tiledMap.node.getComponent(UITransform);
        let pixelX: number = point.x - uit.width * uit.anchorX;
        let pixelY: number = point.y - uit.height * uit.anchorY;
        return new Vec2(pixelX, pixelY);
    }

    /**
     * 滚动地图到指定的地图坐标点
     * @param point 目标地图坐标点
     */
    public scrollToMapPoint(point: Vec2): void {
        // 将地图坐标转换为相机坐标
        let temp = this.toCameraPoint(point);
        let pos = this._mapCamera.node.position.clone();
        let pixelPoint: Vec2 = MapUtil.mapCellToPixelPoint(point);

        // 设置相机新位置
        pos.x = temp.x;
        pos.y = temp.y;
        this._mapCamera.node.position = pos;

        // 更新中心点坐标
        this.setCenterMapCellPoint(point, pixelPoint);

        // 更新地图裁剪区域
        this.updateCulling();
    }

    /**
     * 设置当前地图中心点坐标
     * @param point 地图格子坐标
     * @param pixelPoint 像素坐标
     */
    protected setCenterMapCellPoint(point: Vec2, pixelPoint: Vec2): void {
        this._cmd.proxy.setCurCenterPoint(point, pixelPoint);
    }

    /**
     * 更新地图裁剪区域
     * 通过触发变换事件来更新地图的可见区域裁剪
     */
    private updateCulling() {
        if (this._tiledMap) {
            // 触发地图节点的变换事件，更新裁剪区域
            this._tiledMap.node.emit(Node.EventType.TRANSFORM_CHANGED);

            // 延迟再次触发，确保裁剪更新完成
            this.scheduleOnce(() => {
                this._tiledMap.node.emit(Node.EventType.TRANSFORM_CHANGED);
            })
        }
    }

    /**
     * 获取当前相机的坐标位置
     * @returns 相机当前位置的二维坐标
     */
    public curCameraPoint(): Vec2 {
        let pos = this._mapCamera.node.position;
        return new Vec2(pos.x, pos.y);
    }

    /**
     * 将地图坐标转换为相机坐标，并限制在边界范围内
     * @param point 地图坐标点
     * @returns 限制在边界内的相机坐标点
     */
    public toCameraPoint(point: Vec2) {
        // 将地图格子坐标转换为像素坐标
        let pixelPoint: Vec2 = MapUtil.mapCellToPixelPoint(point);

        // 限制坐标在地图边界范围内
        let positionX: number = Math.min(this._maxMapX, Math.max(-this._maxMapX, pixelPoint.x));
        let positionY: number = Math.min(this._maxMapY, Math.max(-this._maxMapY, pixelPoint.y));

        return new Vec2(positionX, positionY);
    }
}
