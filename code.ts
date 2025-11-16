// Token Picker Plugin
// Loads design tokens from ld-tokens.json and applies them to selected components/frames

figma.showUI(__html__, { width: 600, height: 700 });

// Resolve token references (e.g., "{ld.primitive.font.size.500}" -> actual value)
function resolveTokenValue(value: string | number, tokens: any, path: string = ''): any {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    const refPath = value.slice(1, -1);
    const pathParts = refPath.split('.');
    
    let current: any = tokens;
    for (const part of pathParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }
    
    if (current && typeof current === 'object' && '$value' in current) {
      return resolveTokenValue(current.$value, tokens, refPath);
    }
    
    return current;
  }

  return value;
}

// Get value from a token path
function getTokenValue(path: string, tokens: any): any {
  const pathParts = path.split('.');
  let current: any = tokens;
  
  for (const part of pathParts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  
  if (current && typeof current === 'object' && '$value' in current) {
    return resolveTokenValue(current.$value, tokens, path);
  }
  
  return current;
}

// Flatten tokens into a searchable structure
function flattenTokens(obj: any, tokens: any, prefix: string = '', result: Array<{path: string; name: string; value: any; type: string}> = []): Array<{path: string; name: string; value: any; type: string}> {
  for (const key in obj) {
    if (key === '$type' || key === '$value') continue;
    
    const currentPath = prefix ? `${prefix}.${key}` : key;
    const current = obj[key];
    
    if (current && typeof current === 'object' && '$value' in current) {
      const resolvedValue = resolveTokenValue(current.$value, tokens, currentPath);
      const tokenType = current.$type || 'unknown';
      
      result.push({
        path: currentPath,
        name: currentPath.split('.').pop() || key,
        value: resolvedValue,
        type: tokenType
      });
    } else if (current && typeof current === 'object') {
      flattenTokens(current, tokens, currentPath, result);
    }
  }
  
  return result;
}

// Extract styles from a node
function extractStyles(node: SceneNode) {
  const styles: {
    fills?: Paint[];
    strokes?: Paint[];
    fontSize?: number;
    fontName?: FontName;
    letterSpacing?: LetterSpacing;
    lineHeight?: LineHeight;
    fontWeight?: number;
    cornerRadius?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    effects?: Effect[];
  } = {};

  if ('fills' in node && node.fills !== figma.mixed && node.fills.length > 0) {
    styles.fills = node.fills;
  }

  if ('strokes' in node && node.strokes !== figma.mixed && node.strokes.length > 0) {
    styles.strokes = node.strokes;
  }

  if ('fontSize' in node && typeof node.fontSize === 'number') {
    styles.fontSize = node.fontSize;
  }

  if ('fontName' in node && node.fontName !== figma.mixed) {
    styles.fontName = node.fontName;
  }

  if ('fontWeight' in node && typeof node.fontWeight === 'number') {
    styles.fontWeight = node.fontWeight;
  }

  if ('letterSpacing' in node && node.letterSpacing !== figma.mixed) {
    styles.letterSpacing = node.letterSpacing;
  }

  if ('lineHeight' in node && node.lineHeight !== figma.mixed) {
    styles.lineHeight = node.lineHeight;
  }

  if ('cornerRadius' in node && typeof node.cornerRadius === 'number') {
    styles.cornerRadius = node.cornerRadius;
  }

  if ('paddingLeft' in node && typeof node.paddingLeft === 'number') {
    styles.paddingLeft = node.paddingLeft;
    styles.paddingRight = node.paddingRight;
    styles.paddingTop = node.paddingTop;
    styles.paddingBottom = node.paddingBottom;
  }

  if ('effects' in node && node.effects.length > 0) {
    styles.effects = node.effects;
  }

  return styles;
}

// Convert hex color to Figma RGB
function hexToRgb(hex: string): { r: number; g: number; b: number; a?: number } | null {
  const rgbaMatch = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10) / 255,
      g: parseInt(rgbaMatch[2], 10) / 255,
      b: parseInt(rgbaMatch[3], 10) / 255,
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
    };
  }

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
      a: result[4] ? parseInt(result[4], 16) / 255 : 1
    };
  }

  return null;
}

// Get selected components and frames
function getSelectedNodes(): (ComponentNode | FrameNode)[] {
  const selection = figma.currentPage.selection;
  return selection.filter(
    (node) => node.type === 'COMPONENT' || node.type === 'FRAME'
  ) as (ComponentNode | FrameNode)[];
}

// Get all available tokens organized by category
function getTokensByCategory(tokens: any) {
  if (!tokens || !tokens.ld) return { colors: [], spacing: [], typography: [], effects: [] };
  
  const allTokens = flattenTokens(tokens.ld, tokens);
  
  return {
    colors: allTokens.filter(t => t.type === 'color'),
    spacing: allTokens.filter(t => t.path.includes('spacing') || t.path.includes('radius')),
    typography: allTokens.filter(t => t.path.includes('font')),
    effects: allTokens.filter(t => t.path.includes('shadow') || t.path.includes('effect'))
  };
}

let tokensData: any = null;

// Handle messages from UI
figma.ui.onmessage = async (msg: {
  type: string;
  tokens?: any;
  tokenPath?: string;
  tokenValue?: any;
  tokenType?: string;
  property?: string;
}) => {
  if (msg.type === 'tokens-loaded') {
    // Tokens loaded from UI
    tokensData = msg.tokens;
    
    const selected = getSelectedNodes();
    const tokensByCategory = getTokensByCategory(tokensData);
    
    if (selected.length > 0) {
      const firstNode = selected[0];
      const extractedStyles = extractStyles(firstNode);
      
      figma.ui.postMessage({
        type: 'init',
        tokens: tokensByCategory,
        selection: selected.map((node) => ({
          id: node.id,
          name: node.name,
          type: node.type,
        })),
        currentStyles: extractedStyles,
      });
    } else {
      figma.ui.postMessage({
        type: 'init',
        tokens: tokensByCategory,
        selection: [],
        currentStyles: null,
      });
    }
  }

  if (msg.type === 'apply-token') {
    const selected = getSelectedNodes();

    if (selected.length === 0) {
      figma.ui.postMessage({
        type: 'error',
        message: 'Please select a component or frame first',
      });
      return;
    }

    if (!msg.tokenPath || !tokensData) {
      figma.ui.postMessage({
        type: 'error',
        message: 'No token selected or tokens not loaded',
      });
      return;
    }

    const tokenValue = getTokenValue(msg.tokenPath, tokensData);
    
    if (tokenValue === null || tokenValue === undefined) {
      figma.ui.postMessage({
        type: 'error',
        message: 'Token value not found',
      });
      return;
    }

    selected.forEach((node) => {
      try {
        if (msg.tokenType === 'color' || msg.property === 'fill') {
          const rgb = hexToRgb(String(tokenValue));
          if (rgb && 'fills' in node) {
            node.fills = [{ 
              type: 'SOLID', 
              color: { r: rgb.r, g: rgb.g, b: rgb.b },
              opacity: rgb.a !== undefined ? rgb.a : 1
            }];
          }
        }

        if (msg.property === 'fontSize' && typeof tokenValue === 'number' && 'fontSize' in node) {
          node.fontSize = tokenValue;
        }

        if (msg.property === 'lineHeight' && typeof tokenValue === 'number' && 'lineHeight' in node) {
          node.lineHeight = { value: tokenValue, unit: 'PIXELS' };
        }

        if (msg.property === 'fontWeight' && typeof tokenValue === 'number' && 'fontWeight' in node) {
          node.fontWeight = tokenValue;
        }

        if (msg.property === 'cornerRadius' && typeof tokenValue === 'number' && 'cornerRadius' in node) {
          node.cornerRadius = tokenValue;
        }

        if (msg.property === 'spacing' && typeof tokenValue === 'number') {
          if ('paddingLeft' in node) {
            const spacing = tokenValue;
            if (msg.tokenPath.includes('padding')) {
              node.paddingLeft = spacing;
              node.paddingRight = spacing;
              node.paddingTop = spacing;
              node.paddingBottom = spacing;
            }
          }
        }
      } catch (error) {
        console.error('Error applying token:', error);
      }
    });

    figma.ui.postMessage({
      type: 'success',
      message: `Applied token to ${selected.length} ${selected.length === 1 ? 'item' : 'items'}`,
    });
  }

  if (msg.type === 'selection-changed') {
    if (!tokensData) return;
    
    const selected = getSelectedNodes();
    const tokensByCategory = getTokensByCategory(tokensData);
    
    if (selected.length > 0) {
      const firstNode = selected[0];
      const extractedStyles = extractStyles(firstNode);
      
      figma.ui.postMessage({
        type: 'selection-changed',
        selection: selected.map((node) => ({
          id: node.id,
          name: node.name,
          type: node.type,
        })),
        currentStyles: extractedStyles,
        tokens: tokensByCategory,
      });
    } else {
      figma.ui.postMessage({
        type: 'selection-changed',
        selection: [],
        currentStyles: null,
        tokens: tokensByCategory,
      });
    }
  }

  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

// Listen for selection changes
figma.on('selectionchange', () => {
  if (tokensData) {
    figma.ui.postMessage({ type: 'selection-changed' });
  }
});
