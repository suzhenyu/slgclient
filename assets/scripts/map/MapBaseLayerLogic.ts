import { _decorator, Component, Node, Prefab, NodePool, instantiate } from 'cc';
const { ccclass, property } = _decorator;

import MapCommand from "./MapCommand";

/**
 * 地图基础图层逻辑类
 * 用于管理地图上的各种元素（如建筑、军队等）的显示和交互
 * 提供了区域管理、节点池管理、数据更新等基础功能
 */
@ccclass('MapBaseLayerLogic')
export default class MapBaseLayerLogic extends Component {
    /** 父级图层节点，用于承载所有子元素 */
    @property(Node)
    parentLayer: Node = null;

    /** 元素预制体，用于创建新的地图元素 */
    @property(Prefab)
    entryPrefab: Prefab = null;

    /** 地图命令管理器实例 */
    protected _cmd: MapCommand;

    /** 节点对象池，用于复用节点以提高性能 */
    protected _itemPool: NodePool = new NodePool();

    /** 
     * 区域-元素映射表
     * 外层Map的key为区域索引，value为该区域内的元素映射
     * 内层Map的key为元素ID，value为对应的Node节点
     */
    protected _itemMap: Map<number, Map<number, Node>> = new Map<number, Map<number, Node>>();

    /**
     * 组件加载时的初始化方法
     */
    protected onLoad(): void {
        this._cmd = MapCommand.getInstance();
    }

    /**
     * 组件销毁时的清理方法
     * 清理所有引用和缓存，防止内存泄漏
     */
    protected onDestroy(): void {
        this._cmd = null;
        // 清理所有区域的元素映射
        this._itemMap.forEach((value: Map<number, Node>, key: number) => {
            value.clear();
        });
        this._itemMap.clear();
        this._itemMap = null;
        // 清理节点池
        this._itemPool.clear();
        this._itemPool = null;
    }

    /**
     * 添加元素到指定区域
     * @param areaIndex 区域索引
     * @param data 元素数据
     * @returns 创建或更新的节点，如果区域不存在则返回null
     */
    public addItem(areaIndex: number, data: any): Node {
        if (this._itemMap.has(areaIndex)) {
            let id: number = this.getIdByData(data);
            let item: Node = this.getItem(areaIndex, id);
            // 如果元素不存在，则创建新元素
            if (item == null) {
                item = this.createItem();
                item.parent = this.parentLayer;
                let list: Map<number, Node> = this._itemMap.get(areaIndex);
                list.set(this.getIdByData(data), item);
            }
            // 更新元素数据
            this.updateItem(areaIndex, data, item);
            return item;
        }
        return null;
    }

    /**
     * 更新指定区域的元素数据
     * @param areaIndex 区域索引
     * @param data 新的元素数据
     * @param item 可选的目标节点，如果不提供则根据数据ID查找
     */
    public updateItem(areaIndex: number, data: any, item: Node = null): void {
        if (this._itemMap.has(areaIndex)) {
            let realItem: Node = item;
            if (item == null) {
                let id: number = this.getIdByData(data);
                realItem = this.getItem(areaIndex, id);
            }
            if (realItem) {
                this.setItemData(realItem, data);
            }
        }
    }

    /**
     * 设置元素节点的数据
     * 子类需要重写此方法来实现具体的数据设置逻辑
     * @param item 目标节点
     * @param data 要设置的数据
     */
    public setItemData(item: Node, data: any): void {
        // 子类重写
    }

    /**
     * 从指定区域移除元素
     * @param areaIndex 区域索引
     * @param id 元素ID
     * @returns 是否成功移除
     */
    public removeItem(areaIndex: number, id: number): boolean {
        let list: Map<number, Node> = this._itemMap.get(areaIndex);
        if (list.has(id)) {
            let item: Node = list.get(id);
            // 将节点放回对象池以便复用
            this._itemPool.put(item);
            list.delete(id);
            return true;
        }
        return false;
    }

    /**
     * 获取指定区域的指定元素节点
     * @param areaIndex 区域索引
     * @param id 元素ID
     * @returns 对应的节点，如果不存在则返回null
     */
    public getItem(areaIndex: number, id: number): Node {
        let list: Map<number, Node> = this._itemMap.get(areaIndex);
        if (list.has(id)) {
            return list.get(id);
        }
        return null;
    }

    /**
     * 创建新的元素节点
     * 优先从对象池获取，如果池为空则实例化新的预制体
     * @returns 新创建的节点
     */
    protected createItem(): Node {
        if (this._itemPool.size() > 0) {
            return this._itemPool.get();
        }
        let node: Node = instantiate(this.entryPrefab);
        return node;
    }

    /**
     * 移除整个区域及其所有元素
     * @param areaIndex 要移除的区域索引
     */
    public removeArea(areaIndex: number): void {
        if (this._itemMap.has(areaIndex)) {
            let list: Map<number, Node> = this._itemMap.get(areaIndex);
            // 将所有节点放回对象池
            list.forEach((node: Node, key: number) => {
                this._itemPool.put(node);
            });
            list.clear();
            this._itemMap.delete(areaIndex);
        }
    }

    /**
     * 添加新的区域
     * @param areaIndex 要添加的区域索引
     */
    public addArea(areaIndex: number): void {
        if (this._itemMap.has(areaIndex) == false) {
            this._itemMap.set(areaIndex, new Map<number, Node>());
        }
    }

    /**
     * 批量更新显示区域
     * 移除不需要的区域，添加新的区域
     * @param addIndexs 要添加的区域索引数组
     * @param removeIndexs 要移除的区域索引数组
     */
    public udpateShowAreas(addIndexs: number[], removeIndexs: number[]): void {
        // 先移除不需要的区域
        for (let i: number = 0; i < removeIndexs.length; i++) {
            this.removeArea(removeIndexs[i]);
        }
        // 再添加新的区域
        for (let i: number = 0; i < addIndexs.length; i++) {
            this.addArea(addIndexs[i]);
        }
    }

    /**
     * 根据区域初始化节点
     * 子类可以重写此方法来实现特定的初始化逻辑
     * @param areaIndex 区域索引
     */
    public initNodeByArea(areaIndex: number): void { }

    /**
     * 从数据对象中获取ID
     * 子类可以重写此方法来适配不同的数据结构
     * @param data 数据对象
     * @returns 元素ID
     */
    public getIdByData(data: any): number {
        return data.id;
    }
}
