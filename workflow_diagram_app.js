(function () {
  'use strict';
  var h = React.createElement;
  var RF = window.ReactFlow;
  var ReactFlowComp = RF.default || RF.ReactFlow;
  var Background = RF.Background,
    Controls = RF.Controls,
    MiniMap = RF.MiniMap,
    Handle = RF.Handle,
    Position = RF.Position;

  var TYPE_LABEL = {
    start: 'Trigger', data: 'Transform', http: 'Kibana API', es: 'Elasticsearch',
    ai: 'AI Skill', flow: 'Decision', sec: 'Security', log: 'Log', end: 'Exit',
  };
  var COLOR = {
    start: '#34d399', data: '#56c7d6', http: '#4aa8ff', es: '#e0a45c',
    ai: '#a98bff', flow: '#d8b24a', sec: '#ec6a92', log: '#7f90ac', end: '#647089',
  };
  var EDGE_COLOR = { ok: '#4aa8ff', skip: '#5a687f', error: '#ec6a92', fan: '#3f5675' };

  // Official Elastic logo (sourced from @elastic/eui logo_elastic icon)
  function Swirl() {
    return h('svg', { className: 'swirl', viewBox: '0 0 32 32', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
      h('path', { fill: '#0B64DD', stroke: '#fff', strokeWidth: 1.2, d: 'M27.565 11.242c5.1 1.94 4.872 9.396-.245 11.127l-.162.055-.167-.039-5.28-1.238-.268-.063-.127-.244-1.4-2.69-.217-.417.352-.31 6.904-6.07.272-.24.338.13Z' }),
      h('path', { fill: '#9ADC30', stroke: '#fff', strokeWidth: 1.2, d: 'm22.047 21.239 4.8 1.125.316.074.11.304.066.19c.623 1.964-.26 3.78-1.652 4.797-1.434 1.048-3.51 1.32-5.182.022l-.29-.225.069-.361 1.037-5.454.117-.615.61.143Z' }),
      h('path', { fill: '#1BA9F5', stroke: '#fff', strokeWidth: 1.2, d: 'm5.01 9.63 5.267 1.255.283.067.122.264 1.235 2.65.187.4-.328.298-6.733 6.1-.272.248-.345-.132C1.939 19.83.72 17.456.752 15.153c.032-2.308 1.321-4.644 3.932-5.508l.162-.054.165.039Z' }),
      h('path', { fill: '#F04E98', stroke: '#fff', strokeWidth: 1.2, d: 'M6.281 4.32c1.416-1.08 3.48-1.387 5.222-.069l.297.226-.07.366-1.053 5.474-.118.615-.609-.144-4.8-1.137-.316-.075-.11-.306c-.709-1.967.149-3.876 1.557-4.95Z' }),
      h('path', { fill: '#02BCB7', stroke: '#fff', strokeWidth: 1.2, d: 'm12.466 14.433 7.03 3.211.188.086.095.183 1.555 2.985.096.184-.04.206-1.165 6.101-.024.122-.068.103c-2.68 3.958-6.902 4.71-10.268 3.26-3.356-1.447-5.834-5.07-5.126-9.736l.033-.21.158-.144 6.884-6.25.293-.265.36.164Z' }),
      h('path', { fill: '#FEC514', stroke: '#fff', strokeWidth: 1.2, d: 'M11.892 4.41C14.438.676 18.741.105 22.134 1.54c3.392 1.433 5.99 4.92 5.102 9.362l-.039.2-.153.133-7.066 6.213-.293.258-.353-.163-7.002-3.21-.201-.093-.094-.2-1.38-2.988-.081-.177.037-.19L11.8 4.633l.023-.121.07-.102Z' })
    );
  }

  function WFNode(props) {
    var d = props.data, n = d.node, t = n.type, c = COLOR[t];
    return h('div', { className: 'wf-node n-' + t + (d.selected ? ' sel' : ''), style: { '--nc': c } },
      h(Handle, { type: 'target', position: Position.Top, style: { opacity: 0, top: 0 } }),
      h('div', { className: 'pad' },
        h('div', { className: 'kicker' },
          h('span', { className: 'dot' }),
          h('span', { className: 'type' }, TYPE_LABEL[t])
        ),
        h('div', { className: 'nm' }, n.label),
        h('div', { className: 'kd' }, n.kind)
      ),
      h(Handle, { type: 'source', position: Position.Bottom, style: { opacity: 0, bottom: 0 } })
    );
  }

  function PhaseNode(props) {
    var d = props.data;
    return h('div', { className: 'phase-band' },
      h('div', { className: 'label' }, h('span', { className: 'num' }, d.num), d.text)
    );
  }

  var nodeTypes = { wf: WFNode, phase: PhaseNode };

  function Detail(props) {
    var n = props.node;
    if (!n) {
      return h('div', { className: 'empty' },
        h('div', { className: 'ring' }, '\u2728'),
        h('div', { className: 't' }, 'Explore the workflow'),
        h('div', { className: 's' }, 'Select any step to see what it does, its inputs and outputs, and why it matters.')
      );
    }
    var c = COLOR[n.type];
    var sec = function (title, cls, children) {
      return h('div', { className: 'sec' + (cls ? ' ' + cls : '') }, h('h4', null, title), children);
    };
    var io = function (arr) {
      return h('div', { className: 'io' }, arr.map(function (x, i) {
        return h('div', { className: 'r', key: i }, h('span', { className: 'ar' }, '\u2192'), h('span', null, x));
      }));
    };
    return h('div', { style: { '--nc': c } },
      h('div', { className: 'd-eyebrow eyebrow' }, TYPE_LABEL[n.type]),
      h('h2', { className: 'd-title' }, n.label),
      h('span', { className: 'kind-chip' }, (n.sub ? n.sub + '  \u00b7  ' : '') + n.kind),
      sec('What it does', null, h('p', null, n.what)),
      sec('Why it matters', 'why', h('p', null, n.why)),
      n.io && n.io.in && n.io.in.length ? sec('Inputs', null, io(n.io.in)) : null,
      n.io && n.io.out && n.io.out.length ? sec('Outputs', null, io(n.io.out)) : null,
      n.tags && n.tags.length ? sec('Tags', null,
        h('div', { className: 'tags' }, n.tags.map(function (t, i) { return h('span', { className: 'tag', key: i }, t); }))) : null
    );
  }

  function App() {
    var st = React.useState(null);
    var selected = st[0], setSelected = st[1];

    // phase band label nodes, positioned to the left of the first node in each phase
    var phaseNodes = [];
    if (WF.phases) {
      var seen = {};
      WF.nodes.forEach(function (n) {
        if (n.phase && !seen[n.phase]) {
          seen[n.phase] = true;
          var idx = WF.phases.indexOf(n.phase);
          phaseNodes.push({
            id: 'phase-' + idx, type: 'phase', draggable: false, selectable: false, connectable: false,
            position: { x: n.x - 620, y: n.y - 4 },
            data: { text: n.phase, num: String(idx + 1).padStart(2, '0') },
          });
        }
      });
    }

    var rfNodes = WF.nodes.map(function (n) {
      return { id: n.id, type: 'wf', position: { x: n.x, y: n.y }, data: { node: n, selected: selected === n.id } };
    }).concat(phaseNodes);

    var rfEdges = WF.edges.map(function (ed) {
      var color = EDGE_COLOR[ed.kind] || '#33425f';
      var faded = ed.kind === 'fan' || ed.kind === 'skip';
      return {
        id: ed.id, source: ed.source, target: ed.target,
        animated: !!ed.animated, label: ed.label || undefined, type: 'smoothstep', pathOptions: { borderRadius: 18 },
        style: { stroke: color, strokeWidth: ed.animated ? 1.8 : 1.5, strokeOpacity: faded ? 0.42 : 0.85 },
        labelStyle: { fill: faded ? '#8a97ad' : color, fontSize: 10, fontWeight: 700, letterSpacing: '0.3px' },
        labelBgStyle: { fill: '#070b14', fillOpacity: 0.9 },
        labelBgPadding: [7, 3], labelBgBorderRadius: 6,
        markerEnd: { type: RF.MarkerType.ArrowClosed, color: color, width: 14, height: 14 },
      };
    });

    var onNodeClick = React.useCallback(function (_e, node) {
      if (node.type === 'phase') return;
      setSelected(node.id);
    }, []);
    var onPaneClick = React.useCallback(function () { setSelected(null); }, []);
    var selNode = selected ? WF.nodes.filter(function (n) { return n.id === selected; })[0] : null;

    var order = ['start', 'data', 'http', 'es', 'sec', 'ai', 'flow', 'log', 'end'];
    var legendItems = [h('div', { className: 'cap eyebrow', key: 'cap' }, 'Step types')].concat(
      order.map(function (t) {
        return h('div', { className: 'i', key: t },
          h('span', { className: 'sw', style: { background: COLOR[t], color: COLOR[t] } }), TYPE_LABEL[t]);
      }));

    return h('div', { className: 'app' },
      h('div', { className: 'canvas-wrap' },
        h('div', { className: 'topbar' },
          h('div', { className: 'brand' }, h(Swirl), h('span', { className: 'wm' }, 'elastic')),
          h('div', { className: 'divider' }),
          h('div', { className: 'titleblock' },
            h('div', { className: 'eyebrow' }, 'AI-Powered Security \u00b7 Managed Workflow'),
            h('h1', null, 'Security ', h('span', { className: 'grad' }, 'Alert Analysis')),
            h('div', { className: 'desc' }, 'AI-assisted triage: enrich every alert, classify it, record the verdict, and safely auto-close confident false positives.')
          ),
          h('div', { className: 'legend' }, legendItems)
        ),
        h(ReactFlowComp, {
          nodes: rfNodes, edges: rfEdges, nodeTypes: nodeTypes,
          onNodeClick: onNodeClick, onPaneClick: onPaneClick,
          fitView: true, fitViewOptions: { padding: 0.22 },
          minZoom: 0.12, maxZoom: 1.75, defaultEdgeOptions: { type: 'smoothstep' },
          nodesDraggable: false, proOptions: { hideAttribution: true },
        },
          h(Background, { variant: 'dots', color: '#161f36', gap: 30, size: 1.3 }),
          h(Controls, { showInteractive: false }),
          h(MiniMap, {
            pannable: true, zoomable: true, maskColor: 'rgba(7,11,20,0.74)',
            style: { background: '#0a0f1b', border: '1px solid rgba(125,150,195,0.14)' },
            nodeColor: function (nd) { return nd.type === 'phase' ? 'transparent' : (COLOR[nd.data.node.type] || '#4aa8ff'); },
            nodeStrokeWidth: 0, nodeBorderRadius: 3,
          })
        )
      ),
      h('div', { className: 'detail' }, h(Detail, { node: selNode }))
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    h(RF.ReactFlowProvider, null, h(App))
  );
})();
