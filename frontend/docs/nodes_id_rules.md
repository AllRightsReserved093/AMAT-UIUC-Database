# Nodes ID Rules

This document defines the ID rules for React Flow nodes and ports in the frontend node editor.

## Node ID

Node IDs use:

```text
<nodeType><creationOrder>
```

Where:

- `nodeType` is the React Flow node type name.
- `creationOrder` is a four-digit unsigned integer.
- `creationOrder` starts from `0000`.
- `creationOrder` is counted separately for each node type.

Examples:

```text
databaseRootNode0000
databaseRootNode0001
templateNode0000
templateNode0001
geometryFilter0000
previewOutput0000
```

## Port ID

Input and output port IDs are derived from the node ID.

Input ports use:

```text
<nodeId>i<portOrder>
```

Output ports use:

```text
<nodeId>o<portOrder>
```

Where:

- `nodeId` is the full node ID.
- `i` means input.
- `o` means output.
- `portOrder` is a four-digit unsigned integer.
- `portOrder` starts from `0000` within each node.

Examples:

```text
templateNode0000i0000
templateNode0000i0001
templateNode0000o0000
templateNode0000o0001
databaseRootNode0000o0000
```

## Helper Functions

Use the shared helpers from:

```text
src/features/nodes/TemplateNode.tsx
```

```ts
createNodeId(nodeType, creationOrder)
createInputPortId(nodeId, portOrder)
createOutputPortId(nodeId, portOrder)
```

Example:

```ts
const nodeId = createNodeId('templateNode', 0)
const inputId = createInputPortId(nodeId, 0)
const outputId = createOutputPortId(nodeId, 0)
```

Result:

```text
nodeId   = templateNode0000
inputId  = templateNode0000i0000
outputId = templateNode0000o0000
```

## Current Database Root Node

The database root node uses:

```text
node type: databaseRootNode
node id:   databaseRootNode0000
output id: databaseRootNode0000o0000
```

Its output value is the list of all airfoil file names loaded from the backend database.
