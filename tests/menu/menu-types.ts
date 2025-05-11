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
    hasKeyboardDropdowns: boolean | null;
    hasMouseOnlyDropdowns: boolean | null;
    display: string;
    position: string;
    numberOfMenuItems: number | null;
    numberOfVisibleMenuItems: number | null;
    numberOfFocusableMenuItems: number | null;
}

// Define types for the nav element fingerprint with expanded properties
export interface NavFingerprint {
    menuId: string;
    name: string;
    toggleId: string; // ID of the toggle element that controls this menu
    
    // Toggle details
    toggleDetails?: {
        toggleSelector: string;
        success: boolean;
        error?: string;
    };
    
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
        hasAriaExpanded: boolean | null;
        hasAriaControls: boolean | null;
        hasAriaLabel: boolean | null;
        ariaLabelText: string | null;
        hasAriaLabelledBy: boolean | null;
        hasRole: boolean | null;
        roleValue: string | null;
        hasAriaPopup: boolean | null;
    };
    
    // Interaction behavior for desktop
    interactionBehavior: {
        opensOnEnter: boolean | null;
        opensOnSpace: boolean | null;
        opensOnMouseOver: boolean | null;
        opensOnClick: boolean | null;
        closesOnEscape: boolean | null;
        closesOnClickOutside: boolean | null;
    };
    
    // Interaction behavior for mobile
    interactionBehaviorMobile: {
        opensOnEnter: boolean | null;
        opensOnSpace: boolean | null;
        opensOnTap: boolean | null;
        closesOnEscape: boolean | null;
        closesOnTapOutside: boolean | null;
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