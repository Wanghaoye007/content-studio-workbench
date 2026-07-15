import type { TaskProfileId } from '../domain';

export type InteractionMode =
  | 'idle'
  | 'node-selected'
  | 'configuring'
  | 'picking-asset'
  | 'editing-light'
  | 'editing-expand'
  | 'editing-angle'
  | 'submitting';

export type PanelPlacement = 'left' | 'right';

export type WorkbenchInteractionState = {
  mode: InteractionMode;
  selectedNodeIds: string[];
  activeTool: TaskProfileId | null;
  anchorNodeId: string | null;
  panelOpen: boolean;
  assetPickerOpen: boolean;
  panelPlacement: PanelPlacement;
};

export type WorkbenchInteractionEvent =
  | { type: 'SELECT_NODE'; nodeId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'OPEN_TOOL'; tool: TaskProfileId }
  | { type: 'CLOSE_TOOL' }
  | { type: 'OPEN_ASSET_PICKER' }
  | { type: 'CLOSE_ASSET_PICKER' }
  | { type: 'SET_PANEL_PLACEMENT'; placement: PanelPlacement }
  | { type: 'SUBMIT' }
  | { type: 'SUBMISSION_SETTLED'; nodeId: string }
  | { type: 'RESET'; nodeId: string };

export function createInitialInteractionState(nodeId: string): WorkbenchInteractionState {
  return {
    mode: 'node-selected',
    selectedNodeIds: [nodeId],
    activeTool: null,
    anchorNodeId: nodeId,
    panelOpen: false,
    assetPickerOpen: false,
    panelPlacement: 'right',
  };
}

export function reduceWorkbenchInteraction(
  state: WorkbenchInteractionState,
  event: WorkbenchInteractionEvent,
): WorkbenchInteractionState {
  switch (event.type) {
    case 'SELECT_NODE':
      return {
        ...state,
        mode: 'node-selected',
        selectedNodeIds: [event.nodeId],
        activeTool: null,
        anchorNodeId: event.nodeId,
        panelOpen: false,
        assetPickerOpen: false,
      };
    case 'CLEAR_SELECTION':
      return {
        ...state,
        mode: 'idle',
        selectedNodeIds: [],
        activeTool: null,
        anchorNodeId: null,
        panelOpen: false,
        assetPickerOpen: false,
      };
    case 'OPEN_TOOL': {
      const anchorNodeId = state.selectedNodeIds.at(-1);
      if (!anchorNodeId) return state;
      return {
        ...state,
        mode: editingMode(event.tool),
        activeTool: event.tool,
        anchorNodeId,
        panelOpen: true,
        assetPickerOpen: false,
      };
    }
    case 'CLOSE_TOOL':
      return {
        ...state,
        mode: state.selectedNodeIds.length > 0 ? 'node-selected' : 'idle',
        activeTool: null,
        panelOpen: false,
        assetPickerOpen: false,
      };
    case 'OPEN_ASSET_PICKER':
      if (state.activeTool !== 'blend' || !state.panelOpen) return state;
      return { ...state, mode: 'picking-asset', assetPickerOpen: true };
    case 'CLOSE_ASSET_PICKER':
      if (!state.assetPickerOpen) return state;
      return { ...state, mode: 'configuring', assetPickerOpen: false };
    case 'SET_PANEL_PLACEMENT':
      return { ...state, panelPlacement: event.placement };
    case 'SUBMIT':
      if (!state.activeTool || !state.anchorNodeId) return state;
      return {
        ...state,
        mode: 'submitting',
        panelOpen: false,
        assetPickerOpen: false,
      };
    case 'SUBMISSION_SETTLED':
      return {
        ...state,
        mode: 'node-selected',
        selectedNodeIds: [event.nodeId],
        activeTool: null,
        anchorNodeId: event.nodeId,
        panelOpen: false,
        assetPickerOpen: false,
      };
    case 'RESET':
      return createInitialInteractionState(event.nodeId);
  }
}

function editingMode(tool: TaskProfileId): InteractionMode {
  if (tool === 'light') return 'editing-light';
  if (tool === 'expand') return 'editing-expand';
  if (tool === 'angle') return 'editing-angle';
  return 'configuring';
}
