"""中文：定义节点图执行服务使用的数据结构和执行入口。
English: Defines data structures and the execution entry point for node-graph services.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


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


def executer(source_nodes: list[NodeGraphNode], nodes: list[NodeGraphNode]) -> None:
    pass



# --------- Executor Entry ---------

# 主要节点图执行服务入口。
def execute_node_graph(graph: NodeGraph) -> None:

    nodes = graph.nodes
    edges = graph.edges

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
    
    executer(source_nodes, body_nodes)


    pass
