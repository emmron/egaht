const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

// Initialize OpenRouter client for vision models
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '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',
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://eghact.dev',
    'X-Title': 'Eghact Vision Analyzer'
  }
});

const VISION_PROMPT = `You are an expert UI/UX analyzer. Analyze the provided image and generate a detailed, structured description of the UI components.

Your output must be in the following JSON format:
{
  "layout": {
    "type": "grid|flex|absolute",
    "direction": "row|column",
    "sections": []
  },
  "components": [
    {
      "type": "button|input|card|header|nav|list|form|etc",
      "properties": {
        "text": "visible text",
        "placeholder": "placeholder text if input",
        "variant": "primary|secondary|etc",
        "size": "small|medium|large",
        "position": { "x": "left|center|right", "y": "top|middle|bottom" }
      },
      "interactions": ["click", "hover", "input"],
      "children": []
    }
  ],
  "styling": {
    "colors": {
      "primary": "#hex",
      "secondary": "#hex",
      "background": "#hex"
    },
    "spacing": "tight|normal|loose",
    "rounded": true|false
  },
  "semantics": {
    "purpose": "login|dashboard|settings|etc",
    "key_actions": ["login", "submit", "navigate"]
  }
}

Be extremely detailed and accurate. Identify ALL UI elements.`;

/**
 * Analyze an image and extract UI component structure
 * @param {string|Buffer} image - Image path or buffer
 * @returns {Promise<Object>} Structured UI description
 */
async function analyzeImage(image) {
  try {
    let base64Image;
    
    // Handle file path or buffer
    if (typeof image === 'string') {
      const imageBuffer = await fs.readFile(image);
      base64Image = imageBuffer.toString('base64');
    } else if (Buffer.isBuffer(image)) {
      base64Image = image.toString('base64');
    } else {
      throw new Error('Image must be a file path or Buffer');
    }
    
    // Determine image type
    const imageType = 'image/png'; // Can be enhanced to detect actual type
    
    const response = await openai.chat.completions.create({
      model: 'openai/gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: VISION_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.3 // Lower temperature for more consistent output
    });
    
    const content = response.choices[0].message.content;
    
    // Parse JSON response
    try {
      return JSON.parse(content);
    } catch (e) {
      // If not valid JSON, extract JSON from markdown
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      throw new Error('Failed to parse vision model response as JSON');
    }
  } catch (error) {
    console.error('Vision analysis error:', error);
    throw error;
  }
}

/**
 * Convert UI structure to Eghact component description
 * @param {Object} uiStructure - Structured UI from vision model
 * @returns {string} Natural language description for component generator
 */
function uiStructureToPrompt(uiStructure) {
  const { layout, components, styling, semantics } = uiStructure;
  
  let prompt = `Create a ${semantics.purpose || 'component'} with `;
  
  // Describe layout
  if (layout.type === 'grid') {
    prompt += `a grid layout `;
  } else if (layout.type === 'flex') {
    prompt += `a ${layout.direction} flex layout `;
  }
  
  // Describe components
  const componentDescriptions = components.map(comp => {
    let desc = `a ${comp.properties.size || ''} ${comp.properties.variant || ''} ${comp.type}`;
    if (comp.properties.text) {
      desc += ` with text "${comp.properties.text}"`;
    }
    if (comp.properties.placeholder) {
      desc += ` with placeholder "${comp.properties.placeholder}"`;
    }
    return desc;
  }).join(', ');
  
  prompt += `containing ${componentDescriptions}. `;
  
  // Add styling info
  if (styling.colors.primary) {
    prompt += `Use ${styling.colors.primary} as primary color. `;
  }
  if (styling.rounded) {
    prompt += `Make elements rounded. `;
  }
  
  // Add interactions
  const interactions = [...new Set(components.flatMap(c => c.interactions || []))];
  if (interactions.length > 0) {
    prompt += `Include ${interactions.join(', ')} interactions. `;
  }
  
  return prompt;
}

/**
 * Generate detailed component specification from UI structure
 * @param {Object} uiStructure - Structured UI from vision model
 * @returns {Object} Component specification
 */
function generateComponentSpec(uiStructure) {
  const { layout, components, styling, semantics } = uiStructure;
  
  const spec = {
    name: semantics.purpose ? `${semantics.purpose}Component` : 'Component',
    props: [],
    state: [],
    handlers: [],
    template: {
      root: layout.type === 'flex' ? 'div' : layout.type,
      className: `${layout.type}-layout ${layout.direction || ''}`.trim(),
      children: []
    },
    styles: {}
  };
  
  // Extract props from component properties
  const propSet = new Set();
  components.forEach(comp => {
    if (comp.properties.text && !comp.properties.text.includes('hardcoded')) {
      propSet.add(`title:string:"${comp.properties.text}"`);
    }
    if (comp.properties.variant) {
      propSet.add(`variant:string:"${comp.properties.variant}"`);
    }
  });
  
  spec.props = Array.from(propSet).map(p => {
    const [name, type, defaultValue] = p.split(':');
    return { name, type, default: defaultValue.replace(/"/g, '') };
  });
  
  // Generate state based on interactions
  if (components.some(c => c.type === 'form')) {
    spec.state.push({ name: 'formData', initial: '{}' });
    spec.state.push({ name: 'errors', initial: '{}' });
    spec.state.push({ name: 'isSubmitting', initial: 'false' });
  }
  
  if (components.some(c => c.type === 'input')) {
    components.filter(c => c.type === 'input').forEach((input, idx) => {
      const fieldName = input.properties.placeholder ? 
        input.properties.placeholder.toLowerCase().replace(/\s+/g, '') : 
        `field${idx}`;
      spec.state.push({ name: fieldName, initial: '""' });
    });
  }
  
  // Generate handlers
  if (components.some(c => c.interactions?.includes('click'))) {
    spec.handlers.push({
      name: 'handleClick',
      body: 'console.log("Clicked!");'
    });
  }
  
  if (components.some(c => c.type === 'form')) {
    spec.handlers.push({
      name: 'handleSubmit',
      body: 'if (validateForm()) { isSubmitting = true; /* submit logic */ }'
    });
  }
  
  // Generate template structure
  spec.template.children = components.map(comp => ({
    tag: comp.type === 'button' ? 'button' : 
         comp.type === 'input' ? 'input' :
         comp.type === 'card' ? 'div' : 'div',
    className: `${comp.type} ${comp.properties.variant || ''}`.trim(),
    props: comp.type === 'input' ? { 
      type: 'text', 
      placeholder: comp.properties.placeholder 
    } : {},
    content: comp.properties.text || '',
    events: comp.interactions?.map(i => ({ type: i, handler: `handle${i.charAt(0).toUpperCase() + i.slice(1)}` }))
  }));
  
  // Generate styles based on styling info
  if (styling.colors.primary) {
    spec.styles.primaryColor = styling.colors.primary;
  }
  if (styling.colors.background) {
    spec.styles.backgroundColor = styling.colors.background;
  }
  spec.styles.spacing = styling.spacing || 'normal';
  spec.styles.rounded = styling.rounded || false;
  
  return spec;
}

/**
 * Full pipeline: Image → Analysis → Eghact Component
 * @param {string|Buffer} image - Image to analyze
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated component and metadata
 */
async function imageToEghactComponent(image, options = {}) {
  // Step 1: Analyze image
  const uiStructure = await analyzeImage(image);
  
  // Step 2: Generate component specification
  const componentSpec = generateComponentSpec(uiStructure);
  
  // Step 3: Convert to natural language prompt
  const prompt = uiStructureToPrompt(uiStructure);
  
  // Step 4: Generate Eghact component using existing generator
  const { generateEghactComponent } = require('./index');
  const result = await generateEghactComponent(prompt, {
    ...options,
    componentSpec // Pass spec for enhanced generation
  });
  
  return {
    ...result,
    metadata: {
      ...result.metadata,
      uiStructure,
      componentSpec,
      visionAnalysis: true
    }
  };
}

/**
 * Analyze multiple images and generate a component system
 * @param {Array<string|Buffer>} images - Multiple images to analyze
 * @returns {Promise<Object>} Component system
 */
async function analyzeDesignSystem(images) {
  const analyses = await Promise.all(images.map(analyzeImage));
  
  // Extract common patterns
  const commonColors = {};
  const commonComponents = {};
  const commonLayouts = {};
  
  analyses.forEach(analysis => {
    // Aggregate colors
    Object.entries(analysis.styling.colors).forEach(([key, value]) => {
      commonColors[value] = (commonColors[value] || 0) + 1;
    });
    
    // Aggregate component types
    analysis.components.forEach(comp => {
      commonComponents[comp.type] = (commonComponents[comp.type] || 0) + 1;
    });
    
    // Aggregate layouts
    commonLayouts[analysis.layout.type] = (commonLayouts[analysis.layout.type] || 0) + 1;
  });
  
  return {
    designTokens: {
      colors: Object.entries(commonColors)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([color]) => color),
      spacing: analyses[0].styling.spacing,
      rounded: analyses.some(a => a.styling.rounded)
    },
    componentLibrary: Object.keys(commonComponents),
    layoutPatterns: Object.keys(commonLayouts),
    analyses
  };
}

module.exports = {
  analyzeImage,
  uiStructureToPrompt,
  generateComponentSpec,
  imageToEghactComponent,
  analyzeDesignSystem
};