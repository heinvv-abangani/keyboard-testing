// Define toggle fingerprint interface
export interface ToggleFingerprint {
    toggleId: string;
    name: string;
    
    // Basic selector information
    tagName: string;
    id: string;
    classes: string;
    
    // Content information
    text: string;
    iconType: string; // e.g., "hamburger", "arrow", "plus", etc.
    
    // Structure information
    parentId: string;
    parentClass: string;
    
    // Style information
    display: string;
    visibility: string;
    position: string;
    
    // Visibility on different devices
    isVisibleDesktop: boolean;
    isVisibleMobile: boolean;
    
    // Accessibility attributes
    ariaAttributes: {
        hasAriaExpanded: boolean;
        ariaExpandedValue: string;
        hasAriaControls: boolean;
        ariaControlsValue: string;
        hasAriaLabel: boolean;
        ariaLabelText: string;
        hasAriaHidden: boolean;
        hasAriaPressed: boolean;
        hasAriaPopup: boolean;
    };
    
    // Interaction behavior
    interactionBehavior: {
        respondsToEnter: boolean;
        respondsToSpace: boolean;
        respondsToClick: boolean;
        respondsToHover: boolean;
        togglesOnFocus: boolean;
        respondsToTap: boolean;
    };
    
    // Controlled menu information
    controlledMenu: {
        menuId: string;
        menuType: string;
        isVisible: boolean;
        menuTypeMobile: string;
        isVisibleMobile: boolean;
    };
    
    // Notes about the toggle
    notes: string[];
}

export interface ToggleDetail {
    selector: string;
    fingerprint: ToggleFingerprint;
    element: HTMLElement;
}

export interface ToggleInfo {
    total: number;
    toggleDetails: ToggleDetail[];
    toggleIds: string[];
}