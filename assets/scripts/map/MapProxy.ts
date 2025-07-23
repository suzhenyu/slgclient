import { _decorator, TiledMapAsset, Vec2, game, view } from 'cc';
import MapUtil from "./MapUtil";
import { EventMgr } from '../utils/EventMgr';
import { LogicEvent } from '../common/LogicEvent';

/**
 * 地图资源配置类
 * 用于存储地图上各种建筑和资源点的基础配置信息
 */
export class MapResConfig {
    /** 资源类型 */
    type: number = 0;
    /** 资源等级 */
    level: number = 0;
    /** 资源名称 */
    name: string = "";
    /** 木材产量 */
    wood: number = 0;
    /** 铁矿产量 */
    iron: number = 0;
    /** 石料产量 */
    stone: number = 0;
    /** 粮食产量 */
    grain: number = 0;
    /** 耐久度 */
    durable: number = 0;
    /** 守军数量 */
    defender: number = 0;
}

/**
 * 地图资源类型常量定义
 * 定义了地图上各种建筑和资源点的类型编号
 */
export class MapResType {
    /** 系统要塞 */
    static SYS_FORTRESS: number = 50;
    /** 系统城市 */
    static SYS_CITY: number = 51;
    /** 木材资源点 */
    static WOOD: number = 52;
    /** 铁矿资源点 */
    static IRON: number = 53;
    /** 石料资源点 */
    static STONE: number = 54;
    /** 粮食资源点 */
    static GRAIN: number = 55;
    /** 玩家要塞 */
    static FORTRESS: number = 56;
}

/**
 * 地图资源数据类
 * 存储地图上每个资源点的具体信息
 */
export class MapResData {
    /** 资源点唯一ID */
    id: number = 0;
    /** 资源类型 */
    type: number = 0;
    /** 资源等级 */
    level: number = 0;
    /** X坐标 */
    x: number = 0;
    /** Y坐标 */
    y: number = 0;
}

/**
 * 地图标记位置类
 * 用于存储玩家在地图上设置的标记点信息
 */
export class MapTagPos {
    /** X坐标 */
    x: number = 0;
    /** Y坐标 */
    y: number = 0;
    /** 标记名称 */
    name: string = "";
}

/**
 * 地图区域数据类
 * 地图被划分为多个区域，每个区域包含固定数量的格子
 * 这是地图系统的核心优化机制，只加载玩家视野周围的区域
 */
export class MapAreaData {
    /** 查询时间间隔限制（毫秒） */
    static MAX_TIME: number = 10000;
    /** 区域唯一ID */
    id: number = 0;
    /** 区域X坐标 */
    x: number = 0;
    /** 区域Y坐标 */
    y: number = 0;
    /** 区域起始格子X坐标 */
    startCellX: number = 0;
    /** 区域起始格子Y坐标 */
    startCellY: number = 0;
    /** 区域结束格子X坐标 */
    endCellX: number = 0;
    /** 区域结束格子Y坐标 */
    endCellY: number = 0;
    /** 区域边长（格子数量） */
    len: number = 0;
    /** 查询开始时间戳 */
    qryStartTime: number = 0;

    /**
     * 检查并更新查询时间
     * 用于控制区域数据的查询频率，避免频繁请求
     * @returns 是否可以进行新的查询
     */
    public checkAndUpdateQryTime(): boolean {
        let nowTime: number = Date.now();
        if (nowTime - this.qryStartTime >= MapAreaData.MAX_TIME) {
            this.qryStartTime = nowTime;
            return true
        }
        return false;
    }

    /**
     * 判断两个区域是否相等
     * @param other 要比较的区域数据
     * @returns 是否相等
     */
    public equals(other: MapAreaData): boolean {
        if (other == null) {
            return false;
        }
        return this.id == other.id;
    }

    /**
     * 模糊比较两个区域是否相近
     * 用于判断区域变化是否需要重新加载数据
     * @param other 要比较的区域数据
     * @param variance 允许的偏差范围
     * @returns 是否在偏差范围内
     */
    public fuzzyEquals(other: MapAreaData, variance: number): boolean {
        if (other == null) {
            return false;
        }
        if (this.x - variance <= other.x && other.x <= this.x + variance) {
            if (this.y - variance <= other.y && other.y <= this.y + variance)
                return true;
        }
        return false;
    }
}

/**
 * 地图代理类
 * SLG游戏地图系统的核心管理类，负责：
 * 1. 地图数据的存储和管理
 * 2. 地图区域的动态加载和卸载
 * 3. 地图资源配置的管理
 * 4. 地图标记功能的实现
 */
export default class MapProxy {
    /** 免战时间（秒） */
    public warFree: number = 0;
    /** 瓦片地图资源 */
    public tiledMapAsset: TiledMapAsset = null;
    /** 当前地图中心点坐标 */
    protected _curCenterPoint: Vec2 = null;
    /** 当前展示区域ID */
    protected _curCenterAreaId: number = -1;
    /** 地图区域数据数组 */
    protected _mapAreaDatas: MapAreaData[] = [];
    /** 地图资源数据数组 */
    protected _mapResDatas: MapResData[] = [];
    /** 系统城市资源数据数组 */
    protected _mapSysCityResDatas: MapResData[] = [];
    /** 地图位置标记数组 */
    protected _mapPosTags: MapTagPos[] = [];
    /** 地图请求队列，存储需要加载的区域ID */
    public qryAreaIds: number[] = [];
    /** 地图资源配置映射表，key为"type_level"格式 */
    protected _mapResConfigs: Map<string, MapResConfig> = new Map<string, MapResConfig>();

    /**
     * 初始化地图数据
     * 预分配地图区域数据数组的长度
     */
    public initData(): void {
        this._mapAreaDatas.length = MapUtil.areaCount;
    }

    /**
     * 清空地图数据
     * 重置所有地图相关的状态和数据
     */
    public clearData(): void {
        this._curCenterPoint = null;
        this._curCenterAreaId = -1;
        this._mapAreaDatas.length = 0;
        this.qryAreaIds.length = 0;
    }

    /**
     * 设置地图建筑基础配置信息
     * 从服务器获取的配置数据转换为本地配置对象
     * @param configList 配置数据列表
     */
    public setNationMapConfig(configList: any[]): void {
        this._mapResConfigs.clear();
        for (let i: number = 0; i < configList.length; i++) {
            let cfg: MapResConfig = new MapResConfig();
            cfg.type = configList[i].type;
            cfg.level = configList[i].level;
            cfg.name = configList[i].name;
            cfg.wood = configList[i].Wood;
            cfg.iron = configList[i].iron;
            cfg.stone = configList[i].stone;
            cfg.grain = configList[i].grain;
            cfg.durable = configList[i].durable;
            cfg.defender = configList[i].defender;
            this._mapResConfigs.set(configList[i].type + "_" + cfg.level, cfg);
        }
    }

    /**
     * 设置免战时间
     * @param time 免战时间（秒）
     */
    public setWarFree(time): void {
        this.warFree = time;
    }

    /**
     * 获取免战时间
     * @returns 免战时间（毫秒）
     */
    public getWarFree(): number {
        return this.warFree * 1000
    }

    /**
     * 初始化地图资源配置
     * 解析服务器返回的地图数据，构建资源点信息
     * @param jsonData 包含地图宽度和资源列表的JSON数据
     */
    public initMapResConfig(jsonData: any): void {
        let w: number = jsonData.w;
        let list: Array<Array<number>> = jsonData.list;
        this._mapResDatas = [];
        this._mapSysCityResDatas = [];
        for (let i: number = 0; i < jsonData.list.length; i++) {
            let data: MapResData = new MapResData();
            data.id = i;
            data.type = list[i][0];
            data.level = list[i][1];
            data.x = i % w;
            data.y = Math.floor(i / w);
            this._mapResDatas.push(data);

            // 单独存储系统城市数据，用于快速查找
            if (data.type == MapResType.SYS_CITY) {
                this._mapSysCityResDatas.push(data)
            }
        }
    }

    /**
     * 获取指定坐标附近的系统城市资源数据
     * 根据城市等级确定影响范围，等级越高影响范围越大
     * @param x X坐标
     * @param y Y坐标
     * @returns 系统城市资源数据，如果没有则返回null
     */
    public getSysCityResData(x, y): MapResData {
        for (let index = 0; index < this._mapSysCityResDatas.length; index++) {
            var resData = this._mapSysCityResDatas[index];
            var level = resData.level;
            var dis = 0;
            // 根据城市等级确定影响范围
            if (level >= 8) {
                dis = 3;
            } else if (level >= 5) {
                dis = 2;
            } else {
                dis = 1;
            }

            // 检查指定坐标是否在城市影响范围内
            if (dis >= Math.abs(x - resData.x) && dis >= Math.abs(y - resData.y)) {
                return resData;
            }
        }
        return null;
    }

    /**
     * 设置地图当前中心点
     * 这是系统的核心优化机制：
     * 1. 地图被划分为多个区域(Area)
     * 2. 每个区域包含 N*N 个格子
     * 3. 只加载玩家视野周围的9个区域(3*3九宫格)
     * 4. 当中心点变化时，动态加载/卸载区域数据
     * 
     * @param point 格子坐标
     * @param pixelPoint 像素坐标
     * @returns 是否发生了中心点变化
     */
    public setCurCenterPoint(point: Vec2, pixelPoint: Vec2): boolean {
        if (this._curCenterPoint == null
            || this._curCenterPoint.x != point.x
            || this._curCenterPoint.y != point.y) {
            this._curCenterPoint = point;
            let areaPoint: Vec2 = MapUtil.getAreaPointByCellPoint(point.x, point.y);
            let areaId: number = MapUtil.getIdByAreaPoint(areaPoint.x, areaPoint.y);

            // 发送地图中心点变化事件
            EventMgr.emit(LogicEvent.mapEenterChange, this._curCenterPoint);

            if (this._curCenterAreaId == -1 || this._curCenterAreaId != areaId) {
                // 展示区域发生变化，需要重新计算加载/卸载的区域
                let areaData: MapAreaData = this.getMapAreaData(areaId);
                let oldIds: number[] = null;
                let newIds: number[] = MapUtil.get9GridVaildAreaIds(areaData.id);
                let addIds: number[] = [];
                let removeIds: number[] = [];
                let firstAreaIds: number[] = null;
                let otherAreaIds: number[] = [];

                if (this._curCenterAreaId == -1
                    || this.getMapAreaData(this._curCenterAreaId).fuzzyEquals(areaData, 3) == false) {
                    // 全量刷新：首次加载或区域变化较大
                    oldIds = [];
                    addIds = newIds;

                    // 计算屏幕四个角所在的区域，用于确定优先加载的区域
                    let temp = pixelPoint.clone();
                    let leftTopPixelPoint: Vec2 = temp.add(new Vec2(-view.getVisibleSize().width * 0.5, view.getVisibleSize().height * 0.5));
                    temp = pixelPoint.clone();

                    let leftDownPixelPoint: Vec2 = temp.add(new Vec2(-view.getVisibleSize().width * 0.5, -view.getVisibleSize().height * 0.5));
                    temp = pixelPoint.clone();

                    let rightTopPixelPoint: Vec2 = temp.add(new Vec2(view.getVisibleSize().width * 0.5, view.getVisibleSize().height * 0.5));
                    temp = pixelPoint.clone();

                    let rightDownPixelPoint: Vec2 = temp.add(new Vec2(view.getVisibleSize().width * 0.5, -view.getVisibleSize().height * 0.5));
                    temp = pixelPoint.clone();

                    firstAreaIds = MapUtil.getVaildAreaIdsByPixelPoints(temp, leftTopPixelPoint, leftDownPixelPoint, rightTopPixelPoint, rightDownPixelPoint);
                } else {
                    // 增量更新：计算需要新增和移除的区域
                    oldIds = MapUtil.get9GridVaildAreaIds(this._curCenterAreaId);
                    for (let i: number = 0; i < newIds.length; i++) {
                        if (oldIds.indexOf(newIds[i]) == -1) {
                            addIds.push(newIds[i]);
                        }
                    }
                    for (let i: number = 0; i < oldIds.length; i++) {
                        if (newIds.indexOf(oldIds[i]) == -1) {
                            removeIds.push(oldIds[i]);
                        }
                    }
                    // 优先请求中心区域
                    if (addIds.indexOf(areaData.id)) {
                        firstAreaIds = [areaData.id];
                    }
                }

                // 分离优先加载和普通加载的区域
                if (firstAreaIds && firstAreaIds.length > 0) {
                    for (let i: number = 0; i < addIds.length; i++) {
                        if (firstAreaIds.indexOf(addIds[i]) == -1) {
                            otherAreaIds.push(addIds[i]);
                        }
                    }
                } else {
                    otherAreaIds = addIds;
                }

                // 构建查询队列，优先区域在前
                let qryIndexs: number[] = null;
                if (firstAreaIds && firstAreaIds.length > 0) {
                    qryIndexs = firstAreaIds.concat(otherAreaIds);
                } else {
                    qryIndexs = otherAreaIds;
                }
                this.qryAreaIds = this.qryAreaIds.concat(qryIndexs);

                this._curCenterAreaId = areaId;
                // 发送地图显示区域变化事件
                EventMgr.emit(LogicEvent.mapShowAreaChange, point, this._curCenterAreaId, addIds, removeIds);
            }
            return true;
        }
        return false;
    }

    /**
     * 获取当前地图中心点
     * @returns 当前中心点坐标
     */
    public getCurCenterPoint(): Vec2 {
        return this._curCenterPoint;
    }

    /**
     * 获取当前中心区域ID
     * @returns 当前中心区域ID
     */
    public getCurCenterAreaId(): number {
        return this._curCenterAreaId;
    }

    /**
     * 获取地图区域数据
     * 如果区域数据不存在，则创建新的区域数据
     * @param id 区域ID
     * @returns 区域数据对象
     */
    public getMapAreaData(id: number): MapAreaData {
        if (this._mapAreaDatas[id] == undefined) {
            let data: MapAreaData = new MapAreaData();
            data.id = id;
            let point: Vec2 = MapUtil.getAreaPointById(id);
            let startCellPoint: Vec2 = MapUtil.getStartCellPointByAreaPoint(point.x, point.y);
            data.x = point.x;
            data.y = point.y;
            data.startCellX = startCellPoint.x;
            data.startCellY = startCellPoint.y;
            data.endCellX = startCellPoint.x + MapUtil.areaCellSize.width;
            data.endCellY = startCellPoint.y + MapUtil.areaCellSize.width;
            data.len = MapUtil.areaCellSize.width;
            this._mapAreaDatas[id] = data;
            return data;
        }
        return this._mapAreaDatas[id];
    }

    /**
     * 获取资源产量描述列表
     * 根据配置生成资源产量的文字描述
     * @param cfg 资源配置对象
     * @returns 产量描述字符串数组
     */
    public getResYieldDesList(cfg: MapResConfig): string[] {
        let list: string[] = [];
        if (cfg.grain > 0) {
            list.push("粮食 +" + cfg.grain + "/小时");
        }
        if (cfg.wood > 0) {
            list.push("木材 +" + cfg.wood + "/小时");
        }
        if (cfg.iron > 0) {
            list.push("铁矿 +" + cfg.iron + "/小时");
        }
        if (cfg.stone > 0) {
            list.push("石料 +" + cfg.stone + "/小时");
        }
        return list;
    }

    /**
     * 根据ID获取资源数据
     * @param id 资源ID
     * @returns 资源数据对象
     */
    public getResData(id: number): MapResData {
        return this._mapResDatas[id];
    }

    /**
     * 根据类型和等级获取资源配置
     * @param type 资源类型
     * @param level 资源等级
     * @returns 资源配置对象，如果不存在则返回null
     */
    public getResConfig(type: number, level: number): MapResConfig {
        let key: string = type + "_" + level;
        if (this._mapResConfigs.has(key)) {
            return this._mapResConfigs.get(key);
        }
        return null;
    }

    /**
     * 检查是否有资源数据
     * @returns 是否存在资源数据
     */
    public hasResDatas(): boolean {
        return this._mapResDatas.length > 0;
    }

    /**
     * 检查是否有资源配置
     * @returns 是否存在资源配置
     */
    public hasResConfig(): boolean {
        return this._mapResConfigs.size > 0;
    }

    /**
     * 更新地图位置标记
     * 批量更新所有位置标记数据
     * @param posTag 位置标记数据数组
     */
    public updateMapPosTags(posTag: any): void {
        this._mapPosTags = [];
        posTag.forEach(data => {
            var tag = new MapTagPos();
            tag.x = data.x;
            tag.y = data.y;
            tag.name = data.name;
            this._mapPosTags.push(tag);
        });
    }

    /**
     * 移除指定位置的地图标记
     * @param x X坐标
     * @param y Y坐标
     */
    public removeMapPosTag(x: number, y: number): void {
        var tags: MapTagPos[] = [];
        this._mapPosTags.forEach(tag => {
            if (tag.x != x || y != tag.y) {
                tags.push(tag);
            }
        });
        this._mapPosTags = tags;
    }

    /**
     * 添加地图位置标记
     * 如果指定位置已存在标记，则不会重复添加
     * @param x X坐标
     * @param y Y坐标
     * @param name 标记名称
     */
    public addMapPosTag(x: number, y: number, name: string): void {
        var tag = new MapTagPos();
        tag.x = x;
        tag.y = y;
        tag.name = name;

        var ok = true;
        this._mapPosTags.forEach(tag => {
            if (tag.x == x && tag.y == y) {
                ok = false;
            }
        });

        if (ok) {
            this._mapPosTags.push(tag);
        }
    }

    /**
     * 检查指定位置是否有标记
     * @param x X坐标
     * @param y Y坐标
     * @returns 是否存在标记
     */
    public isPosTag(x: number, y: number): boolean {
        var ret = false;
        for (let index = 0; index < this._mapPosTags.length; index++) {
            const tag = this._mapPosTags[index];
            if (tag.x == x && tag.y == y) {
                ret = true;
                break;
            }
        }
        return ret;
    }

    /**
     * 获取所有位置标记
     * @returns 位置标记数组
     */
    public getPosTags(): MapTagPos[] {
        return this._mapPosTags;
    }
}
