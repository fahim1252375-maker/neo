import {setup} from '../../setup.mjs';

const appName = 'VdomMetaAndAutoMountWithoutWorkerTest';

setup({
    neoConfig: {
        allowVdomUpdatesInTests: true,
        useDomApiRenderer      : true,
        useVdomWorker          : false
    },
    appConfig: {
        name: appName
    }
});

import {test, expect} from '@playwright/test';
import Neo            from '../../../../src/Neo.mjs';
import Component      from '../../../../src/component/Base.mjs';

/**
 * Component that supplies contextual VDOM metadata for the update batch.
 * @class Test.Unit.VdomMetaAndAutoMountWithoutWorker.MetaComponent
 * @extends Neo.component.Base
 */
class MetaComponent extends Component {
    static config = {
        className: 'Test.Unit.VdomMetaAndAutoMountWithoutWorker.MetaComponent'
    }

    getVdomUpdateMeta() {
        return {baselineScrollTop: 42}
    }
}

MetaComponent = Neo.setupClass(MetaComponent);

test.describe('VDOM metadata and auto-mount without a VDOM worker', () => {
    test('forwards update metadata with the deltas to the Main Thread', async () => {
        const component         = Neo.create(MetaComponent, {appName, id: 'vdom-meta-no-worker', html: 'before'}),
              realApplyDeltas   = Neo.applyDeltas,
              applied           = [];

        try {
            await component.initVnode(true);

            Neo.applyDeltas = async (windowId, deltas, meta) => {
                applied.push({windowId, deltas, meta})
            };

            component.html = 'after';
            await component.promiseUpdate();

            const update = applied.find(entry => entry.deltas.some(delta => delta.id === component.id));

            expect(update).toBeTruthy();
            expect(update.meta).toEqual({[component.id]: {baselineScrollTop: 42}})
        } finally {
            Neo.applyDeltas = realApplyDeltas;
            component.destroy()
        }
    });

    test('sends an insertNode delta for autoMount through the shared helper', async () => {
        const component       = Neo.create(Component, {appName, id: 'vdom-auto-mount-helper'}),
              realApplyDeltas = Neo.applyDeltas,
              applied         = [];

        try {
            await component.ready();

            Neo.applyDeltas = async (windowId, deltas, meta) => {
                applied.push({windowId, deltas, meta})
            };

            const data = await component.createAndMountVnode({
                appName,
                autoMount  : true,
                parentId   : 'vdom-auto-mount-parent',
                parentIndex: 4,
                vdom       : {id: 'vdom-auto-mount-child', tag: 'div', text: 'created'},
                windowId   : component.windowId
            });

            expect(applied).toHaveLength(1);
            expect(applied[0].windowId).toBe(component.windowId);
            expect(applied[0].deltas).toHaveLength(1);
            expect(applied[0].deltas[0]).toMatchObject({
                action  : 'insertNode',
                id      : 'vdom-auto-mount-child',
                index   : 4,
                parentId: 'vdom-auto-mount-parent',
                vnode   : data.vnode
            })
        } finally {
            Neo.applyDeltas = realApplyDeltas;
            component.destroy()
        }
    });
});
