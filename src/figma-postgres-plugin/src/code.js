figma.showUI(__html__, {
  width: 400,
  height: 500,
});

figma.ui.onmessage = (msg) => {
  if (msg.type === 'execute-sql') {
    figma.ui.postMessage({ type: 'sql-result', data: '执行成功' });
  }
};
