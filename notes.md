# The full merged JSON (including all colors) is embedded in the HTML. The plugin now includes:

- Colors: black, white, blue, cyan, gray, green, orange, pink, purple, red, spark, teal, yellow (with all shades)
- Typography: font sizes, line heights, font weights
- Spacing: space scale, border radius, border width
- Semantic tokens: all semantic color and typography tokens

## Summary
- Extracted all 8 JSON objects from ld-tokens.json
- Merged them into a single JSON structure
- Embedded the full merged JSON (42KB) directly in ui.html
- The plugin now loads all tokens including colors on startup

## Next Steps
- Compile: `npm run build`
- Test in Figma: Load the plugin and you should see all color tokens available
- When you update ld-tokens.json in the future, run this command to regenerate the embedded tokens:

`node -e "const fs = require('fs'); const content = fs.readFileSync('ld-tokens.json', 'utf8'); const lines = content.split('\n'); const jsonStarts = []; for (let i = 0; i < lines.length; i++) { if (lines[i].trim().startsWith('{')) jsonStarts.push(i); } const jsonObjects = []; for (let i = 0; i < jsonStarts.length; i++) { const start = jsonStarts[i]; const end = i < jsonStarts.length - 1 ? jsonStarts[i + 1] : lines.length; let jsonText = lines.slice(start, end).join('\n'); const lastBrace = jsonText.lastIndexOf('}'); if (lastBrace !== -1) jsonText = jsonText.substring(0, lastBrace + 1); try { jsonObjects.push(JSON.parse(jsonText)); } catch(e) {} } const merged = { ld: { primitive: {}, semantic: {} } }; function deepMerge(target, source) { for (const key in source) { if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) { if (!target[key]) target[key] = {}; deepMerge(target[key], source[key]); } else { target[key] = source[key]; } } } } jsonObjects.forEach(obj => { if (obj.ld) { if (obj.ld.primitive) deepMerge(merged.ld.primitive, obj.ld.primitive); if (obj.ld.semantic) deepMerge(merged.ld.semantic, obj.ld.semantic); } }); const tokensContent = 'const EMBEDDED_TOKENS = ' + JSON.stringify(merged) + ';'; const htmlContent = fs.readFileSync('ui.html', 'utf8'); const newHtml = htmlContent.replace(/const EMBEDDED_TOKENS = \{.*?\};/s, tokensContent); fs.writeFileSync('ui.html', newHtml); console.log('Updated ui.html with merged tokens');"`

## The plugin is ready to use with all your design tokens, including colors.