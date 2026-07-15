import { describe, expect, it } from 'vitest';
import {
  createInitialInteractionState,
  reduceWorkbenchInteraction,
} from '../src/workbench/interactionMachine';

describe('workbench interaction machine', () => {
  it('opens a tool against the selected node and enters its editing mode', () => {
    const selected = reduceWorkbenchInteraction(
      createInitialInteractionState('scene:scene-source'),
      { type: 'OPEN_TOOL', tool: 'light' },
    );

    expect(selected).toMatchObject({
      mode: 'editing-light',
      activeTool: 'light',
      anchorNodeId: 'scene:scene-source',
      panelOpen: true,
    });
  });

  it('maps expand and angle tools to image-surface editing modes', () => {
    const initial = createInitialInteractionState('result:result-1');

    expect(reduceWorkbenchInteraction(initial, { type: 'OPEN_TOOL', tool: 'expand' }).mode)
      .toBe('editing-expand');
    expect(reduceWorkbenchInteraction(initial, { type: 'OPEN_TOOL', tool: 'angle' }).mode)
      .toBe('editing-angle');
  });

  it('returns from the asset picker to the blend configuration', () => {
    const opened = reduceWorkbenchInteraction(
      reduceWorkbenchInteraction(
        createInitialInteractionState('scene:scene-source'),
        { type: 'OPEN_TOOL', tool: 'blend' },
      ),
      { type: 'OPEN_ASSET_PICKER' },
    );

    expect(opened).toMatchObject({ mode: 'picking-asset', assetPickerOpen: true });
    expect(reduceWorkbenchInteraction(opened, { type: 'CLOSE_ASSET_PICKER' })).toMatchObject({
      mode: 'configuring',
      assetPickerOpen: false,
      panelOpen: true,
    });
  });

  it('clears temporary layers when submission starts', () => {
    const editing = reduceWorkbenchInteraction(
      createInitialInteractionState('result:result-1'),
      { type: 'OPEN_TOOL', tool: 'expand' },
    );

    expect(reduceWorkbenchInteraction(editing, { type: 'SUBMIT' })).toMatchObject({
      mode: 'submitting',
      panelOpen: false,
      assetPickerOpen: false,
    });
  });

  it('does not open tools without a selected node', () => {
    const empty = reduceWorkbenchInteraction(
      createInitialInteractionState('scene:scene-source'),
      { type: 'CLEAR_SELECTION' },
    );

    expect(reduceWorkbenchInteraction(empty, { type: 'OPEN_TOOL', tool: 'generate' }))
      .toEqual(empty);
  });

  it('resets all transient state to the supplied source node', () => {
    const selectingAsset = reduceWorkbenchInteraction(
      reduceWorkbenchInteraction(
        createInitialInteractionState('result:result-1'),
        { type: 'OPEN_TOOL', tool: 'blend' },
      ),
      { type: 'OPEN_ASSET_PICKER' },
    );

    expect(reduceWorkbenchInteraction(selectingAsset, {
      type: 'RESET',
      nodeId: 'scene:scene-source',
    })).toEqual(createInitialInteractionState('scene:scene-source'));
  });
});
