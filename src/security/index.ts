export { CSPGenerator, CSPConfig, AssetInfo } from './csp-generator';
export { eghactCSP, CSPPluginOptions } from './csp-plugin';

// Re-export convenience function
export function createCSPPlugin(options?: CSPPluginOptions) {
  return eghactCSP(options);
}