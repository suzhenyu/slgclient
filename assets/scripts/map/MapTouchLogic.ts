import { _decorator, Component, Prefab, Node, Vec2, instantiate, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

import { MapBuildData } from "./MapBuildProxy";
import { MapCityData } from "./MapCityProxy";
import MapClickUILogic from "./MapClickUILogic";
import MapCommand from "./MapCommand";
import { MapResData } from "./MapProxy";
import MapUtil from "./MapUtil";
import { EventMgr } from '../utils/EventMgr';
import { LogicEvent } from '../common/LogicEvent';

/**
 * 地图触摸逻辑处理类
 * 负责处理地图上的点击和移动事件，显示相应的UI界面
 */
@ccclass('MapTouchLogic')
export default class MapTouchLogic extends Component {
    @property(Prefab)
    clickUIPrefab: Prefab = null; // 点击UI预制体

    @property(Node)
    touch: Node = null; // 触摸节点容器

    protected _cmd: MapCommand; // 地图命令管理器
    protected _clickUINode: Node = null; // 当前显示的点击UI节点

    /**
     * 组件加载时初始化
     */
    protected onLoad(): void {
        this._cmd = MapCommand.getInstance(); // 获取地图命令管理器实例
        EventMgr.on(LogicEvent.touchMap, this.onTouchMap, this); // 监听地图点击事件
        EventMgr.on(LogicEvent.moveMap, this.onMoveMap, this); // 监听地图移动事件
    }

    /**
     * 组件销毁时清理资源
     */
    protected onDestroy(): void {
        EventMgr.targetOff(this); // 移除所有事件监听
        this._cmd = null;
        this._clickUINode = null;
    }

    /**
     * 处理地图点击事件
     * @param mapPoint 地图坐标点
     * @param clickPixelPoint 像素坐标点
     */
    protected onTouchMap(mapPoint: Vec2, clickPixelPoint: Vec2): void {
        console.log("点击区域 (" + mapPoint.x + "," + mapPoint.y + ")");
        this.removeClickUINode(); // 移除之前的点击UI

        // 检查点击位置是否有效
        if (MapUtil.isVaildCellPoint(mapPoint) == false) {
            console.log("点击到无效区域");
            return;
        }

        // 根据地图坐标获取格子ID
        let cellId: number = MapUtil.getIdByCellPoint(mapPoint.x, mapPoint.y);

        // 检查是否点击了城市
        let cityData: MapCityData = this._cmd.cityProxy.getCity(cellId);;
        if (cityData != null) {
            // 点击的是城市，显示城市信息UI
            clickPixelPoint = MapUtil.mapCellToPixelPoint(new Vec2(cityData.x, cityData.y));
            this.showClickUINode(cityData, clickPixelPoint);
            return;
        }

        // 检查是否点击了建筑
        let buildData: MapBuildData = this._cmd.buildProxy.getBuild(cellId);
        if (buildData != null) {
            if (buildData.isSysCity() == false) {
                // 点击的是被占领的区域，显示建筑信息UI
                console.log("点击被占领的区域", buildData);
                this.showClickUINode(buildData, clickPixelPoint);
                return;
            }
        }

        // 检查是否点击了资源点
        let resData: MapResData = this._cmd.proxy.getResData(cellId);
        if (resData.type > 0) {
            // 获取系统城池资源数据
            var temp = MapCommand.getInstance().proxy.getSysCityResData(resData.x, resData.y);
            if (temp) {
                // 如果是系统城池，显示城池信息
                clickPixelPoint = MapUtil.mapCellToPixelPoint(new Vec2(temp.x, temp.y));
                let cellId: number = MapUtil.getIdByCellPoint(temp.x, temp.y);
                let buildData: MapBuildData = this._cmd.buildProxy.getBuild(cellId);
                if (buildData) {
                    this.showClickUINode(buildData, clickPixelPoint);
                } else {
                    this.showClickUINode(temp, clickPixelPoint);
                }
                console.log("点击野外城池", temp);
            } else {
                // 显示野外资源点信息
                this.showClickUINode(resData, clickPixelPoint);
                console.log("点击野外区域", resData);
            }

        } else {
            // 点击的是山脉河流等不可交互区域
            console.log("点击山脉河流区域");
        }
    }

    /**
     * 处理地图移动事件
     * 地图移动时隐藏点击UI
     */
    protected onMoveMap(): void {
        this.removeClickUINode();
    }

    /**
     * 显示点击UI节点
     * @param data 要显示的数据（城市、建筑或资源数据）
     * @param pos 显示位置（像素坐标）
     */
    public showClickUINode(data: any, pos: Vec2): void {
        // 如果UI节点不存在，则创建新的
        if (this._clickUINode == null) {
            this._clickUINode = instantiate(this.clickUIPrefab);
        }

        // 设置UI节点的父节点和位置
        this._clickUINode.parent = this.touch;
        this._clickUINode.setPosition(new Vec3(pos.x, pos.y, 0));

        // 设置UI显示的数据
        this._clickUINode.getComponent(MapClickUILogic).setCellData(data, pos);
    }

    /**
     * 移除点击UI节点
     * 将UI节点从父节点中移除，但不销毁，以便复用
     */
    private removeClickUINode(): void {
        if (this._clickUINode) {
            this._clickUINode.parent = null;
        }
    }
}
