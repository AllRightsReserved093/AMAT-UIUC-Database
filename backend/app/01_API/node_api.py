"""中文：定义节点图执行相关的 FastAPI 路由和请求响应模型。
English: Defines FastAPI routes and request/response models for node-graph execution.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field


router = APIRouter(prefix="/node-graph", tags=["node-graph"])


# 节点图请求结构。Node graph request structure.
#
# NodeGraphExecutionRequest
# └── graph: NodeGraph
#     ├── version: int
#     ├── startNodeIds: list[str]
#     ├── nodes: list[NodeGraphNode]
#     │   ├── inputs: list[NodeGraphPort]
#     │   └── outputs: list[NodeGraphPort]
#     ├── edges: list[NodeGraphEdge]
#     │   ├── source: NodeGraphPortReference
#     │   └── target: NodeGraphPortReference
#     └── outlets: list[NodeGraphOutlet]
#         └── sources: list[NodeGraphPortReference]


# --------- Graph Models ---------


class NodeGraphPort(BaseModel):
    """节点输入/输出端口。Node input/output port."""
    id: str
    label: str | None = None
    valueKind: str | None = None


class NodeGraphPortReference(BaseModel):
    """指向某个节点端口的引用。Reference to one concrete node port."""
    nodeId: str
    portId: str


class NodeGraphNode(BaseModel):
    """节点图中的普通计算节点。Normal compute node in the graph."""
    id: str
    type: str
    isStartNode: bool = False
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
    valueKind: str | None = None
    order: int | None = None
    inputPortId: str | None = None
    sources: list[NodeGraphPortReference] = Field(default_factory=list)


class NodeGraph(BaseModel):
    """一次执行请求携带的完整节点图。Complete node graph carried by one execution request."""
    version: int
    startNodeIds: list[str] = Field(default_factory=list)
    nodes: list[NodeGraphNode] = Field(default_factory=list)
    edges: list[NodeGraphEdge] = Field(default_factory=list)
    outlets: list[NodeGraphOutlet] = Field(default_factory=list)


class NodeGraphExecutionRequest(BaseModel):
    """节点图执行接口的请求体。Request body for the node-graph execution endpoint."""
    graph: NodeGraph
