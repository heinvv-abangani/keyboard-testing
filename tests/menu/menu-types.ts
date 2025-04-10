import { Locator } from "@playwright/test";

// Define menu types as an enum
export enum MenuType {
    SimpleMenu = "SimpleMenu",
    DropdownMenu = "DropdownMenu",
    ToggleBasedSimpleMenu = "ToggleBasedSimpleMenu",
    ToggleBasedDropdownMenu = "ToggleBasedDropdownMenu"
}

// Define view-specific information with expanded properties
export interface MenuView {
    menuType: MenuType;
    visibility: boolean | null;
    visibleItems: number | null;
    hasKeyboardDropdowns: boolean;
    hasMouseOnlyDropdowns: boolean;
    display: string;
    position: string;
}

// Define types for the nav element fingerprint with expanded properties
export interface NavFingerprint {
    menuId: string;
    name: string;
    toggleId: string; // ID of the toggle element that controls this menu
    
    // View-specific information for desktop and mobile
    view: {
        desktop: MenuView;
        mobile: MenuView;
    };
    
    // Basic selector information
    tagName: string;
    id: string;
    classes: string;
    
    // Content information
    linkCount: number;
    linkTexts: string;
    hasDropdowns: boolean;
    
    // Structure information
    childrenCount: number;
    childrenTypes: string;
    parentId: string;
    parentClass: string;

    
    // Accessibility attributes
    ariaAttributes: {
        hasAriaExpanded: boolean;
        hasAriaControls: boolean;
        hasAriaLabel: boolean;
        ariaLabelText: string;
        hasAriaLabelledBy: boolean;
        hasRole: boolean;
        roleValue: string;
        hasAriaPopup: boolean;
    };
    
    // Interaction behavior for desktop
    interactionBehavior: {
        opensOnEnter: boolean;
        opensOnSpace: boolean;
        opensOnMouseOver: boolean;
        opensOnClick: boolean;
        closesOnEscape: boolean;
        closesOnClickOutside: boolean;
    };
    
    // Interaction behavior for mobile
    interactionBehaviorMobile: {
        opensOnEnter: boolean;
        opensOnSpace: boolean;
        opensOnTap: boolean;
        closesOnEscape: boolean;
        closesOnTapOutside: boolean;
    };
    
    // Notes about the menu
    notes: string[];
}

export interface NavDetail {
    selector: string;
    fingerprint: NavFingerprint;
    element: HTMLElement;
}

export interface NavGroup {
    representativeIndex: number;
    indices: number[];
    count: number;
    selectors: string[];
    menuId: string; // Store the data-menu-id of the representative element
    // Use the enhanced NavFingerprint
    fingerprint: NavFingerprint;
}

export interface NavInfo {
    total: number;
    uniqueGroups: NavGroup[];
    uniqueIndices: number[];
    menuIds: string[]; // Store all the data-menu-id values
    // Store the complete fingerprints
    fingerprints: NavFingerprint[];
}