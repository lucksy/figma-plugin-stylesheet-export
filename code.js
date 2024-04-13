run();

async function run() {
  if (figma.editorType === "figma") {
    const nodes = figma.currentPage.selection.length
      ? figma.currentPage.selection
      : figma.currentPage.children;
    const stylesheet = await getStylesheet(nodes);
    figma.showUI(`<pre>${stylesheet}</pre>`, { width: 600, height: 700 });
  } else if (figma.editorType === "dev" && figma.mode === "codegen") {
    figma.codegen.on("generate", async ({ node }) => {
      const stylesheet = await getStylesheet([node]);
      return [{ language: "CSS", code: stylesheet, title: "Stylesheet" }];
    });
  }
}

async function getStylesheet(nodes) {
  const stylesheet = {};
  await traverseAggCSS(nodes, stylesheet, []);
  // this is your css
  return Object.values(stylesheet).join("\n\n");
}

function traverseAggCSS(nodes, stylesheet, lineage) {
  return Promise.all(
    nodes.map(async (node) => {
      const css = await node.getCSSAsync();
      const className = getClassNames(node);
      const lineageNew = [...lineage];
      lineageNew.push(`${className}`);
      const entries = Object.entries(css);
      if (entries.length) {
        const selector = `${lineageNew.join(" > ")} {`;
        const cssString = [
          selector,
          ...entries.map(([key, value]) => `  ${key}: ${value};`),
          "}",
        ].join("\n");
        stylesheet[node.id] = cssString;
      }
      if (node.children) {
        await traverseAggCSS(node.children, stylesheet, [...lineageNew]);
      }
      return;
    })
  );
}

function getClassNames(node) {
  let tagsAndAttributes
  try {
    tagsAndAttributes = JSON.parse(node.getSharedPluginData('figma.attributes', 'attributes'));
  } catch (error) {
    return generateFallbackClassName(node);
  }
  
  if (!tagsAndAttributes || Object.keys(tagsAndAttributes).length === 0) {
    return generateFallbackClassName(node);
  }

  let selector = tagsAndAttributes.tag || '';
  if (tagsAndAttributes.attributes) {
    if (tagsAndAttributes.attributes.id) {
      selector += `#${tagsAndAttributes.attributes.id}`;
    }
    if (tagsAndAttributes.attributes.class) {
      selector += tagsAndAttributes.attributes.class.split(' ').map(cls => `.${cls}`).join('');
    }
  }
  return selector;
}

function generateFallbackClassName(node) {
  let className = `.figma-${node.name}-${node.id}`;

  className = className.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  
  if (className[0] === '-') {
      className = '.' + className.slice(1);
  }

  return className;
}
