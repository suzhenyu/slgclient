import { _decorator, Size, Vec2, size, v2, TiledMap, UITransform, game, view } from 'cc';
import MapCommand from "./MapCommand";

/**
 * 地图坐标转换工具类
 * 
 * 系统定义了三种坐标系:
 *  1. 地图格子坐标: 逻辑网格坐标(x,y) - 用于游戏逻辑计算
 *  2. 地图像素坐标: 相对于地图节点的像素坐标 - 用于地图内部渲染
 *  3. 世界像素坐标: Cocos Creator 场景全局坐标 - 用于UI交互和显示
 * 
 * 主要功能:
 * - 各种坐标系之间的相互转换
 * - 地图区域划分和管理
 * - 格子ID和坐标的相互转换
 * - 九宫格和周边区域计算
 * - 视野范围判断
 */
export default class MapUtil {
    /** 地图像素大小 - 整个地图的像素尺寸 */
    protected static _mapPixelSize: Size = null;

    /** 地图锚点偏移量 - 用于坐标转换的偏移值 */
    protected static _mapOffsetPoint: Vec2 = null;

    /** 格子大小 - 单个地图格子的像素尺寸，默认256x128适用于45度斜视角 */
    protected static _tileSize: Size = size(256, 128);

    /** 地图大小 - 地图的格子数量，宽高需要相同 */
    protected static _mapSize: Size = size(20, 20);

    /** 地图原点像素坐标 - 地图(0,0)点对应的像素坐标 */
    protected static _zeroPixelPoint: Vec2 = v2(0, 0);

    /** 区域格子大小 - 用于地图分块管理的区域大小 */
    protected static _areaCellSize: Size = null;

    /** 区域数量 - 地图被划分的区域总数 */
    protected static _areaSize: Size = null;

    /**
     * 初始化地图配置
     * 根据TiledMap组件设置地图的各种参数
     * @param map TiledMap组件实例
     */
    public static initMapConfig(map: TiledMap): void {
        // 获取地图节点的UI变换组件
        var uit = map.node.getComponent(UITransform);

        // 设置地图像素大小
        this._mapPixelSize = size(uit.width, uit.height);

        // 计算地图锚点偏移量
        this._mapOffsetPoint = v2(uit.width * uit.anchorX, uit.height * uit.anchorY);

        // 从TiledMap获取格子和地图大小
        this._tileSize = map.getTileSize();
        this._mapSize = map.getMapSize();
        this._mapPixelSize = size(uit.width, uit.height);

        // 计算地图原点的像素坐标（45度斜视角地图的特殊计算）
        this._zeroPixelPoint.x = this._mapSize.width * this._tileSize.width * 0.5;
        this._zeroPixelPoint.y = this._mapSize.height * this._tileSize.height - this._tileSize.height * 0.5;

        // 获取可视区域大小
        var vsize = view.getVisibleSize();

        // 计算区域划分大小，用于优化渲染性能
        // 根据屏幕高度计算合适的区域大小，确保为偶数且不超过地图高度
        let showH: number = Math.min(Math.ceil(vsize.height / this._tileSize.height / 2) * 2 + 2, this._mapSize.height);
        this._areaCellSize = size(showH, showH);
        this._areaSize = size(Math.ceil(this._mapSize.width / showH), Math.ceil(this._mapSize.height / showH));
    }

    /**
     * 获取地图的像素大小
     * @returns 地图像素尺寸
     */
    public static get mapPixcelSize(): Size {
        return this._mapPixelSize;
    }

    /**
     * 获取地图大小（格子数量）
     * @returns 地图的格子尺寸
     */
    public static get mapSize(): Size {
        return this._mapSize;
    }

    /**
     * 获取地图总格子数量
     * @returns 地图格子总数
     */
    public static get mapCellCount(): number {
        return this._mapSize.width * this._mapSize.height;
    }

    /**
     * 获取每个区域包含的格子数量
     * @returns 区域格子尺寸
     */
    public static get areaCellSize(): Size {
        return this._areaCellSize;
    }

    /**
     * 获取区域大小（区域数量）
     * @returns 区域尺寸
     */
    public static get areaSize(): Size {
        return this._areaSize;
    }

    /**
     * 获取总区域数量
     * @returns 区域总数
     */
    public static get areaCount(): number {
        return this._areaSize.width * this._areaSize.height;
    }

    /**
     * 根据格子坐标获取格子ID
     * @param x 格子X坐标
     * @param y 格子Y坐标
     * @returns 格子的唯一ID
     */
    public static getIdByCellPoint(x: number, y: number): number {
        return x + y * this._mapSize.width;
    }

    /**
     * 根据格子ID获取格子坐标
     * @param id 格子ID
     * @returns 格子坐标
     */
    public static getCellPointById(id: number): Vec2 {
        return v2(id % this._mapSize.width, Math.floor(id / this._mapSize.width));
    }

    /**
     * 根据区域坐标获取区域ID
     * @param x 区域X坐标
     * @param y 区域Y坐标
     * @returns 区域的唯一ID
     */
    public static getIdByAreaPoint(x: number, y: number): number {
        return x + y * this._areaSize.width;
    }

    /**
     * 根据区域ID获取区域坐标
     * @param id 区域ID
     * @returns 区域坐标
     */
    public static getAreaPointById(id: number): Vec2 {
        return v2(id % this._areaSize.width, Math.floor(id / this._areaSize.width));
    }

    /**
     * 获取以指定格子为中心的九宫格ID列表
     * @param id 中心格子ID
     * @returns 九宫格格子ID数组（包含中心格子）
     */
    public static get9GridCellIds(id: number): number[] {
        return [
            id + this._mapSize.width - 1, id + this._mapSize.width, id + this._mapSize.width + 1,
            id - 1, id, id + 1,
            id - this._mapSize.width - 1, id - this._mapSize.width, id - this._mapSize.width + 1
        ];
    }

    /**
     * 获取玩家城市周边的格子ID列表
     * 返回距离中心城市2格范围内的所有边界格子
     * @param id 中心城市格子ID
     * @returns 周边格子ID数组
     */
    public static getSideIdsForRoleCity(id: number): number[] {
        return [
            id + this._mapSize.width * 2 - 2, id + this._mapSize.width * 2 - 1, id + this._mapSize.width * 2, id + this._mapSize.width * 2 + 1, id + this._mapSize.width * 2 + 2,
            id + this._mapSize.width - 2, id + this._mapSize.width + 2,
            id - 2, id + 2,
            id - this._mapSize.width - 2, id - this._mapSize.width + 2,
            id - this._mapSize.width * 2 - 2, id - this._mapSize.width * 2 - 1, id - this._mapSize.width - 1, id - this._mapSize.width * 2 + 1, id - this._mapSize.width * 2 + 2
        ];
    }

    /**
     * 获取系统城市周边的格子ID列表
     * 根据城市等级确定影响范围：等级8+为3格，等级5+为2格，其他为1格
     * @param x 城市X坐标
     * @param y 城市Y坐标
     * @param level 城市等级
     * @returns 周边格子ID数组
     */
    public static getSideIdsForSysCity(x: number, y: number, level: number): number[] {
        let ids: number[] = [];
        var dis = 0;

        // 根据城市等级确定影响距离
        if (level >= 8) {
            dis = 3;
        } else if (level >= 5) {
            dis = 2;
        } else {
            dis = 1;
        }

        // 上边界
        for (let tx = x - dis; tx <= x + dis; tx++) {
            var ty: number = y + dis;
            var id = MapUtil.getIdByCellPoint(tx, ty);
            ids.push(id);
        }

        // 下边界
        for (let tx = x - dis; tx <= x + dis; tx++) {
            var ty: number = y - dis;
            var id = MapUtil.getIdByCellPoint(tx, ty);
            ids.push(id);
        }

        // 左边界
        for (let ty = y - dis; ty <= y + dis; ty++) {
            var tx: number = x - dis;
            var id = MapUtil.getIdByCellPoint(tx, ty);
            ids.push(id);
        }

        // 右边界
        for (let ty = y - dis; ty <= y + dis; ty++) {
            var tx: number = x + dis;
            var id = MapUtil.getIdByCellPoint(tx, ty);
            ids.push(id);
        }

        return ids;
    }

    /**
     * 获取以指定区域为中心的九宫格区域ID列表
     * @param id 中心区域ID
     * @returns 九宫格区域ID数组（包含中心区域）
     */
    public static get9GridAreaIds(id: number): number[] {
        return [
            id + this._areaSize.width - 1, id + this._areaSize.width, id + this._areaSize.width + 1,
            id - 1, id, id + 1,
            id - this._areaSize.width - 1, id - this._areaSize.width, id - this._areaSize.width + 1
        ];
    }

    /**
     * 获取有效的九宫格区域ID列表
     * 过滤掉超出地图边界的区域
     * @param id 中心区域ID
     * @returns 有效的九宫格区域ID数组
     */
    public static get9GridVaildAreaIds(id: number): number[] {
        let list: number[] = [];
        let totalList: number[] = this.get9GridAreaIds(id);
        for (let i: number = 0; i < totalList.length; i++) {
            if (this.isVaildAreaId(totalList[i])) {
                list.push(totalList[i]);
            }
        }
        return list;
    }

    /**
     * 根据格子坐标获取所属区域坐标
     * @param x 格子X坐标
     * @param y 格子Y坐标
     * @returns 区域坐标
     */
    public static getAreaPointByCellPoint(x: number, y: number): Vec2 {
        return v2(Math.floor(x / this._areaCellSize.width), Math.floor(y / this._areaCellSize.height));
    }

    /**
     * 根据格子坐标获取所属区域ID
     * @param x 格子X坐标
     * @param y 格子Y坐标
     * @returns 区域ID
     */
    public static getAreaIdByCellPoint(x: number, y: number): number {
        let point: Vec2 = this.getAreaPointByCellPoint(x, y);
        return this.getIdByAreaPoint(point.x, point.y);
    }

    /**
     * 根据区域坐标获取区域起始格子坐标
     * @param x 区域X坐标
     * @param y 区域Y坐标
     * @returns 区域左上角格子坐标
     */
    public static getStartCellPointByAreaPoint(x: number, y: number): Vec2 {
        return v2(x * this._areaCellSize.width, y * this._areaCellSize.height);
    }

    /**
     * 根据区域坐标获取区域结束格子坐标
     * @param x 区域X坐标
     * @param y 区域Y坐标
     * @returns 区域右下角格子坐标
     */
    public static getEndCellPointByAreaPoint(x: number, y: number): Vec2 {
        return v2((x + 1) * this._areaCellSize.width, (y + 1) * this._areaCellSize.height);
    }

    /**
     * 根据多个像素点获取涉及的有效区域ID列表
     * @param points 像素点数组
     * @returns 去重后的有效区域ID数组
     */
    public static getVaildAreaIdsByPixelPoints(...points: Vec2[]): number[] {
        let list: number[] = [];
        for (let i: number = 0; i < points.length; i++) {
            let cellPoint: Vec2 = this.mapPixelToCellPoint(points[i]);
            let areaPoint: Vec2 = this.getAreaPointByCellPoint(cellPoint.x, cellPoint.y);
            let index: number = this.getIdByAreaPoint(areaPoint.x, areaPoint.y);
            if (this.isVaildAreaId(index) && list.indexOf(index) == -1) {
                list.push(index);
            }
        }
        return list;
    }

    /**
     * 判断格子坐标是否有效（在地图范围内）
     * @param point 格子坐标
     * @returns 是否为有效格子坐标
     */
    public static isVaildCellPoint(point: Vec2): boolean {
        if (point.x >= 0 && point.x < this._mapSize.width
            && point.y >= 0 && point.y < this._mapSize.height) {
            return true;
        }
        return false;
    }

    /**
     * 判断区域坐标是否有效（在区域范围内）
     * @param point 区域坐标
     * @returns 是否为有效区域坐标
     */
    public static isVaildAreaPoint(point: Vec2): boolean {
        if (point.x >= 0 && point.x < this._areaSize.width
            && point.y >= 0 && point.y < this._areaSize.height) {
            return true;
        }
        return false;
    }

    /**
     * 判断区域ID是否有效
     * @param id 区域ID
     * @returns 是否为有效区域ID
     */
    public static isVaildAreaId(id: number): boolean {
        if (id >= 0 && id < this.areaCount) {
            return true;
        }
        return false;
    }

    /**
     * 世界像素坐标转换为地图格子坐标
     * 适用于45度斜视角地图的坐标转换
     * @param point 世界像素坐标
     * @returns 地图格子坐标
     */
    public static worldPixelToMapCellPoint(point: Vec2): Vec2 {
        // 转换原理：
        // TiledMap 45度地图以上方为(0,0)点，以左上方边界为Y轴，右上方边界为X轴的坐标系
        // 将点击坐标点平行映射到地图坐标系的边界上，求解出映射点的像素坐标除以格子大小
        // 即可计算出对应的格子坐标
        let x: number = Math.floor(0.5 * this._mapSize.height + point.x / this._tileSize.width - point.y / this._tileSize.height);
        let y: number = Math.floor(1.5 * this._mapSize.width - point.x / this._tileSize.width - point.y / this._tileSize.height);
        return v2(x, y);
    }

    /**
     * 地图格子坐标转换为世界像素坐标
     * 返回格子中心点的世界像素坐标
     * @param point 地图格子坐标
     * @returns 世界像素坐标
     */
    public static mapCellToWorldPixelPoint(point: Vec2): Vec2 {
        let pixelX: number = this._zeroPixelPoint.x - (point.y - point.x) * this._tileSize.width * 0.5;
        let pixelY: number = this._zeroPixelPoint.y - (point.x + point.y) * this._tileSize.height * 0.5;
        return v2(pixelX, pixelY);
    }

    /**
     * 地图格子坐标转换为地图像素坐标
     * @param point 地图格子坐标
     * @returns 地图像素坐标
     */
    public static mapCellToPixelPoint(point: Vec2): Vec2 {
        let worldPoint: Vec2 = this.mapCellToWorldPixelPoint(point);
        return worldPoint.subtract(this._mapOffsetPoint);
    }

    /**
     * 地图像素坐标转换为地图格子坐标
     * @param point 地图像素坐标
     * @returns 地图格子坐标
     */
    public static mapPixelToCellPoint(point: Vec2): Vec2 {
        let temp = point.clone();
        let worldPoint: Vec2 = temp.add(this._mapOffsetPoint);
        return this.worldPixelToMapCellPoint(worldPoint);
    }

    /**
     * 判断指定坐标的军队是否在玩家视野范围内
     * 视野范围定义为以玩家建筑或城市为中心，半径5格的区域
     * @param x 军队X坐标
     * @param y 军队Y坐标
     * @returns 是否在视野范围内
     */
    public static armyIsInView(x: number, y: number): boolean {
        // 获取建筑和城市代理对象
        let buildProxy = MapCommand.getInstance().buildProxy;
        let cityProxy = MapCommand.getInstance().cityProxy;

        // 获取玩家信息
        let myId = cityProxy.getMyPlayerId();
        let myUnionId = cityProxy.myUnionId;
        // let parentId = cityProxy.myParentId;

        // 遍历以目标坐标为中心，半径为5的区域
        for (let i = Math.max(0, x - 5); i <= Math.min(x + 5, this._mapSize.width); i++) {
            for (let j = Math.max(0, y - 5); j <= Math.min(y + 5, this._mapSize.height); j++) {
                let id: number = MapUtil.getIdByCellPoint(i, j);

                // 检查建筑
                var b = buildProxy.getBuild(id);
                if (b) {
                    // 如果是玩家自己的建筑或同盟建筑，则在视野内
                    if (b.rid == myId || (myUnionId != 0 && (b.unionId == myUnionId || b.parentId == myUnionId))) {
                        return true;
                    }
                }

                // 检查城市
                var c = cityProxy.getCity(id);
                if (c) {
                    // 如果是玩家自己的城市或同盟城市，则在视野内
                    if (c.rid == myId || (myUnionId != 0 && (c.unionId == myUnionId || c.parentId == myUnionId))) {
                        return true;
                    }
                }
            }
        }

        return false;
    }
}
