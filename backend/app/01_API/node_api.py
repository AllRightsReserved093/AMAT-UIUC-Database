"""中文：定义节点图执行相关的 FastAPI 路由和请求模型。
English: Defines FastAPI routes and request models for node-graph execution.
"""

from __future__ import annotations

from importlib import import_module

from fastapi import APIRouter


node_executor = import_module("backend.app.02_services.node_executor")
NodeGraphExecutionRequest = node_executor.NodeGraphExecutionRequest

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




# --------- Routes ---------


# 接收节点图执行请求。响应结构和真实计算逻辑后续再定义。
# Receive a node-graph execution request. Response structure and real execution logic will be defined later.
@router.post("/execute")
def execute_node_graph(request: NodeGraphExecutionRequest) -> None:
    graph = request.graph
    node_executor.execute_node_graph(graph)
