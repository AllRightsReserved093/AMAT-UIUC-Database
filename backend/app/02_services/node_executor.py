"""中文：定义节点图执行服务使用的数据结构和执行入口。
English: Defines data structures and the execution entry point for node-graph services.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from threading import Thread

from collections import deque



# Python 内部字段使用 snake_case；alias 用于接收前端 camelCase JSON。
# Python model fields use snake_case; aliases accept frontend camelCase JSON.


# --------- Graph Models ---------


class NodeGraphPort(BaseModel):
    """节点输入/输出端口。Node input/output port."""

    id: str
    label: str | None = None
    value_kind: str | None = Field(default=None, alias="valueKind")
    next_node_ids: list[str] = Field(default_factory=list, alias="nextNodeIds")


class NodeGraphPortReference(BaseModel):
    """指向某个节点端口的引用。Reference to one concrete node port."""

    node_id: str = Field(alias="nodeId")
    port_id: str = Field(alias="portId")


class NodeGraphNode(BaseModel):
    """节点图中的普通计算节点。Normal compute node in the graph."""

    id: str
    type: str
    params: dict[str, Any] = Field(default_factory=dict)
    inputs: list[NodeGraphPort] = Field(default_factory=list)
    outputs: list[NodeGraphPort] = Field(default_factory=list)


class NodeGraphEdge(BaseModel):
    """节点之间的连线。Edge between two node ports."""

    id: str
    source: NodeGraphPortReference
    target: NodeGraphPortReference


class NodeGraphOutlet(BaseModel):
    """前端期望后端返回结果的数据出口。Output requested by the frontend."""

    id: str
    label: str | None = None
    value_kind: str | None = Field(default=None, alias="valueKind")
    order: int | None = None
    input_port_id: str | None = Field(default=None, alias="inputPortId")
    sources: list[NodeGraphPortReference] = Field(default_factory=list)


class NodeGraph(BaseModel):
    """一次执行请求携带的完整节点图。Complete node graph carried by one execution request."""

    version: int
    start_node_ids: list[str] = Field(default_factory=list, alias="startNodeIds")
    nodes: list[NodeGraphNode] = Field(default_factory=list)
    edges: list[NodeGraphEdge] = Field(default_factory=list)
    outlets: list[NodeGraphOutlet] = Field(default_factory=list)


class NodeGraphExecutionRequest(BaseModel):
    """节点图执行接口的请求体。Request body for the node-graph execution endpoint."""

    graph: NodeGraph


# 

class PendingNode(BaseModel):
    id: str
    pending_input_numbers: int
    pending_inputs: dict[str, Any] # [port_id, value] 
    

# --------- Executor Helpers ---------

# 根据节点 id 建立索引，并在重复 id 时直接报错。
# Build a node index by node id, and fail fast when duplicate ids exist.
def build_node_index(graph: NodeGraph) -> dict[str, NodeGraphNode]:
    node_index: dict[str, NodeGraphNode] = {}

    for node in graph.nodes:
        if node.id in node_index:
            raise ValueError(f"Duplicate node id: {node.id}")

        node_index[node.id] = node

    return node_index

# --------- Node Execution Logic ---------

# 获取下一个节点列表。
# Get the next node list. 
def get_next_nodes(node: NodeGraphNode, port_id: str | None) -> list[NodeGraphNode] | None:
    next_node_ids: list[NodeGraphNode] = []
    if port_id is not None:
        for output_port in node.outputs:
            if output_port.id == port_id:
                for next_node_id in output_port.next_node_ids:
                    next_node_ids.append(next_node_id)
                break
    else:
        for output_port in node.outputs:
            for next_node_id in output_port.next_node_ids:
                next_node_ids.append(next_node_id)

    return next_node_ids if next_node_ids else None

# 检查下一个节点是否为线性节点（即只有一个输入和一个输出）。
# Check if the next node is a linear node (i.e., has only one input and one output).
def is_next_node_linear(node: NodeGraphNode, port_id: str | None) -> bool:
    next_node_ids = get_next_nodes(node, port_id)

    if not next_node_ids or len(next_node_ids) != 1:
        return False

    for next_node in next_node_ids:
        if len(next_node.inputs) > 1 or len(next_node.outputs) > 1:
            return False
        
    return True

def node_compute(node: NodeGraphNode, inputs: list[Any]) -> Any:
    pass

def node_linear_executor(node: NodeGraphNode, inputs: list[Any]) -> Any, list[NodeGraphNode] | None:
    # 是线性，直接执行
    output = node_compute(node, inputs)
    
    # 获取下一个节点列表
    next_node_ids = get_next_nodes(node, node.outputs[0].id)

    if next_node_ids is None:
        # 没有下一个节点，执行结束
        return output, None

    if len(next_node_ids) == 1:
        # 下一个节点存在且为线性节点
        if is_next_node_linear(next_node_ids[0], None):
            # 递归执行下一个节点
            return node_linear_executor(next_node_ids[0], [output])

    return output, next_node_ids 
    


def node_executer_schedualer(source_nodes: list[NodeGraphNode], nodes: list[NodeGraphNode], outlet_sources: list[NodeGraphNode]) -> None:
    # 计划执行节点树，按线性节点顺序执行，遇到分支时将分支节点加入待执行列表。
    # Schedule the execution of the node tree, executing linear nodes in order, and adding branch nodes to the pending list when branches are encountered.
    
    # Pending_nodes: 
    inputs: list[Any] = []
    pending_nodes = deque()
    

    for source_node in source_nodes:
        pending_node = PendingNode(id=source_node.id, pending_input_numbers=len(source_node.inputs), pending_inputs={})
        pending_nodes.append(pending_node)

    while pending_nodes:
        current_node = pending_nodes.popleft()

        # 先判断是否可执行
        if current_node.pending_input_numbers > 0:
            # 还没有收到所有输入，继续等待
            pending_nodes.append(current_node)
            continue
        # 到这里说明可执行

        # 调取当前节点的输入
        inputs = list(current_node.pending_inputs.values())

        # 执行当前节点，以及其后续的线性节点，直到遇到分支，合并，或没有下一个节点
        outputs, next_node_ids = node_linear_executor(source_nodes[0], [])

        if next_node_ids is None:
            # 死胡同
            continue
        
        # 存在下一个节点，分支，合并，或是外展接口

        if len(next_node_ids) == 1:
            # 只有一个下一个节点，说明是合并或是外展接口
            # 检查是否是外展接口

        for node in next_node_ids:
            input_index[next_node_ids] = node
        
        pending_nodes.append((next_node_ids, [outputs]))

        if next_node_ids is None:
            # 整个节点树都是线性的，且没有下一个节点，执行结束
            return output
        else:
            # 节点树有多个起始节点
            for source_node in source_nodes:
                outputs, next_node_ids = node_linear_executor(source_node, [])
                inputs.append(outputs)
                pending_nodes.append((next_node_ids, [outputs]))
            
        for node in pending_nodes:
        
        



    

    break

    



# --------- Executor Entry ---------

# 主要节点图执行服务入口。
def execute_node_graph(graph: NodeGraph) -> None:

    nodes = graph.nodes
    edges = graph.edges
    outlet_sources = graph.outlets

    node_index = build_node_index(graph)

    for edge in edges:
        source_node = node_index[edge.source.node_id]
        for output_port in source_node.outputs:
            if output_port.id == edge.source.port_id:
                output_port.next_node_ids.append(edge.target.node_id)
                break

    source_nodes: list[NodeGraphNode] = []
    body_nodes: list[NodeGraphNode] = []
    for node in nodes:
        if not node.inputs:
            source_nodes.append(node)
        else:
            body_nodes.append(node)
    
    node_executer_schedualer(source_nodes, body_nodes, outlet_sources)


    pass
