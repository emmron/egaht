const { 
  uiStructureToPrompt, 
  generateComponentSpec,
  imageToEghactComponent 
} = require('../src/index');

// Mock UI structures that would come from vision analysis
const mockUIStructures = {
  loginForm: {
    layout: { type: 'flex', direction: 'column' },
    components: [
      {
        type: 'header',
        properties: { text: 'Sign In', size: 'large', variant: 'h1' }
      },
      {
        type: 'input',
        properties: { placeholder: 'Email address', size: 'medium' },
        interactions: ['input', 'focus']
      },
      {
        type: 'input',
        properties: { placeholder: 'Password', size: 'medium' },
        interactions: ['input', 'focus']
      },
      {
        type: 'checkbox',
        properties: { text: 'Remember me' },
        interactions: ['click']
      },
      {
        type: 'button',
        properties: { text: 'Sign In', variant: 'primary', size: 'large' },
        interactions: ['click']
      },
      {
        type: 'link',
        properties: { text: 'Forgot password?' },
        interactions: ['click']
      }
    ],
    styling: {
      colors: {
        primary: '#1976d2',
        secondary: '#dc004e',
        background: '#ffffff'
      },
      spacing: 'normal',
      rounded: true
    },
    semantics: {
      purpose: 'login',
      key_actions: ['authenticate', 'reset_password']
    }
  },
  
  dashboard: {
    layout: { type: 'grid', sections: ['header', 'sidebar', 'main'] },
    components: [
      {
        type: 'nav',
        properties: { position: { x: 'left', y: 'top' } },
        children: [
          { type: 'link', properties: { text: 'Dashboard' } },
          { type: 'link', properties: { text: 'Analytics' } },
          { type: 'link', properties: { text: 'Settings' } }
        ]
      },
      {
        type: 'card',
        properties: { variant: 'stats' },
        children: [
          { type: 'text', properties: { text: 'Total Users' } },
          { type: 'text', properties: { text: '1,234', size: 'large' } }
        ]
      },
      {
        type: 'chart',
        properties: { variant: 'line' }
      }
    ],
    styling: {
      colors: {
        primary: '#3f51b5',
        background: '#f5f5f5'
      },
      spacing: 'loose',
      rounded: false
    },
    semantics: {
      purpose: 'dashboard',
      key_actions: ['view_stats', 'navigate']
    }
  },
  
  productCard: {
    layout: { type: 'flex', direction: 'column' },
    components: [
      {
        type: 'image',
        properties: { alt: 'Product image' }
      },
      {
        type: 'text',
        properties: { text: 'Premium Wireless Headphones', size: 'medium', variant: 'h3' }
      },
      {
        type: 'text',
        properties: { text: '$299.99', size: 'large', variant: 'price' }
      },
      {
        type: 'rating',
        properties: { value: 4.5, max: 5 }
      },
      {
        type: 'button',
        properties: { text: 'Add to Cart', variant: 'primary' },
        interactions: ['click']
      }
    ],
    styling: {
      colors: {
        primary: '#ff6f00',
        secondary: '#ffc107'
      },
      spacing: 'tight',
      rounded: true
    },
    semantics: {
      purpose: 'product',
      key_actions: ['add_to_cart', 'view_details']
    }
  }
};

async function demonstrateVisionPipeline() {
  console.log('🎨 Vision to Eghact Component Demo\n');
  
  for (const [name, uiStructure] of Object.entries(mockUIStructures)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📸 Mock UI: ${name}`);
    console.log('='.repeat(60));
    
    // Step 1: Convert to prompt
    const prompt = uiStructureToPrompt(uiStructure);
    console.log('\n📝 Generated Prompt:');
    console.log(prompt);
    
    // Step 2: Generate component spec
    const spec = generateComponentSpec(uiStructure);
    console.log('\n🔧 Component Spec:');
    console.log(`- Name: ${spec.name}`);
    console.log(`- Props: ${spec.props.map(p => p.name).join(', ')}`);
    console.log(`- State: ${spec.state.map(s => s.name).join(', ')}`);
    console.log(`- Handlers: ${spec.handlers.map(h => h.name).join(', ')}`);
    console.log(`- Template children: ${spec.template.children.length}`);
    
    // Step 3: Show what the component would include
    console.log('\n✨ Component Features:');
    console.log(`- Layout: ${uiStructure.layout.type}`);
    console.log(`- Components: ${uiStructure.components.length}`);
    console.log(`- Primary color: ${uiStructure.styling.colors.primary || 'default'}`);
    console.log(`- Interactions: ${[...new Set(uiStructure.components.flatMap(c => c.interactions || []))].join(', ')}`);
  }
  
  console.log('\n\n🚀 Full Pipeline Example (Login Form):');
  console.log('─'.repeat(60));
  
  // Simulate the full pipeline with mock data
  try {
    // In real usage, this would be: imageToEghactComponent('path/to/image.png')
    // For demo, we'll use the component generator directly with the mock data
    const { generateEghactComponent } = require('../src/index');
    const prompt = uiStructureToPrompt(mockUIStructures.loginForm);
    const spec = generateComponentSpec(mockUIStructures.loginForm);
    
    console.log('\nGenerating Turing-complete .egh component...\n');
    
    const result = await generateEghactComponent(prompt, {
      componentSpec: spec
    });
    
    console.log('📄 Generated .egh Component:');
    console.log(result.code);
    
  } catch (error) {
    console.log('\n⚠️  Note: Full generation requires OpenRouter API access');
    console.log('Component would be generated with:');
    console.log('- Turing-complete state management');
    console.log('- Proper .egh syntax (no JSX!)');
    console.log('- Reactive computations ($:)');
    console.log('- Event handlers (@click, @input)');
    console.log('- Control flow (#if, #each)');
  }
}

// Run the demo
if (require.main === module) {
  demonstrateVisionPipeline().catch(console.error);
}

module.exports = { mockUIStructures, demonstrateVisionPipeline };