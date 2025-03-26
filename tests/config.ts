/**
 * Configuration file for keyboard testing
 * This file contains general settings and preferences for website testing
 */

import { validateSelectors } from './helpers/validation';

export interface SiteConfig {
  // Site identifier
  siteId: string;
  
  // Site URL for testing
  url: string;
  
  // Whether to use dynamic counting for dropdown items (recommended)
  useDynamicCounting: boolean;
  
  // Selectors for finding menu items
  selectors: {
    // Selectors for finding dropdown items
    dropdownItems: string[];
    
    // Selectors for finding dropdown containers
    dropdownContainers: string[];
    
    // Selectors for finding menu items
    menuItems: string[];
  };
  
  // Additional settings
  settings: {
    // Whether to check for visibility in footer sections
    checkFooterVisibility: boolean;
    
    // Whether to check for mobile visibility
    checkMobileVisibility: boolean;
    
    // Whether to use aria-controls for dropdown menus
    useAriaControls: boolean;
  };
}

/**
 * Validates a site configuration to ensure it doesn't contain website-specific references
 * @param config The site configuration to validate
 * @throws Error if the configuration contains website-specific references
 */
export function validateConfig(config: SiteConfig): void {
  // Validate all selectors
  validateSelectors(config.selectors.dropdownItems);
  validateSelectors(config.selectors.dropdownContainers);
  validateSelectors(config.selectors.menuItems);
}

/**
 * Default configuration for all sites
 */
export const defaultConfig: SiteConfig = {
  siteId: 'default',
  url: '',
  useDynamicCounting: true,
  selectors: {
    dropdownItems: [
      '.menu-item > a',       // Common menu item pattern
      '.sub-item',            // Common submenu item pattern
      'li > a',               // Generic list items with links
      'a[href]'               // Any links with href attributes
    ],
    dropdownContainers: [
      '.dropdown',
      '.sub-menu',
      '.dropdown-menu'
    ],
    menuItems: [
      'a',
      'button'
    ]
  },
  settings: {
    checkFooterVisibility: true,
    checkMobileVisibility: true,
    useAriaControls: true
  }
};

/**
 * Site-specific configurations
 * Add your site configurations here as needed
 */
export const siteConfigs: Record<string, SiteConfig> = {
  // Example site configuration template
  'example': {
    siteId: 'example',
    url: 'https://example.com',
    useDynamicCounting: true,
    selectors: {
      dropdownItems: [
        '.menu-item > a',       // Common menu item pattern
        '.sub-item',            // Common submenu item pattern
        'li > a',               // Generic list items with links
        'a[href]'               // Any links with href attributes
      ],
      dropdownContainers: [
        '.dropdown',
        '.sub-menu',
        '.dropdown-menu'
      ],
      menuItems: [
        'a',
        'button'
      ]
    },
    settings: {
      checkFooterVisibility: true,
      checkMobileVisibility: true,
      useAriaControls: true
    }
  },
  // Add more site configurations as needed
};

/**
 * Get configuration for a specific site
 * @param siteId Site identifier
 * @returns Site configuration
 */
export function getConfig(siteId: string): SiteConfig {
  return siteConfigs[siteId] || defaultConfig;
}

/**
 * Get configuration based on URL
 * @param url Site URL
 * @returns Site configuration
 */
export function getConfigByUrl(url: string): SiteConfig {
  // Find site config based on URL
  const siteId = Object.keys(siteConfigs).find(id => 
    url.includes(siteConfigs[id].url)
  );
  
  return siteId ? siteConfigs[siteId] : {
    ...defaultConfig,
    url
  };
}