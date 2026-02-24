
/**
 * This function creates an element, defines it's type
 * and adds one or more classes.
 * @param {*} type          Type of element (div, p, table, etc)
 * @param {*} classList     List of classes - can be null
 * @returns 
 */
export function createElement(type, classList = [], content, id) {
    const element = document.createElement(type);
    if (classList.length > 0)   { element.classList.add(...classList); }
    if (id)                     { element.id = id; }
    if (content != null)        { element.textContent = content; }
    return element;
}

/**
 * Utility function to add styles, classes, and attributes to an element
 * With this function we reduce the need for multiple lines of code every time we want to style an element.
 * @param {*} element       The specific element you want to style
 * @param {*} styles        CSS editing
 * @param {*} classList     If not null, adds 1 or more classes to element.
 * @param {*} attrs         Attribute editing
 */
export function formatElement(element, styles = {}, classList = [], attrs = {}) {
    Object.assign(element.style, styles);
    if (classList.length > 0) {
        element.classList.add(...classList);
    }
    Object.assign(element, attrs);
}

/**
 * Utility function to append an element to the parent element.
 * This is exactly the same as just writing "x.appendchild(y)"
 * but it follows the code-style better.
 * 
 * @param {*} parent        The parent element
 * @param {*} target        The element to insert
 * @returns 
 */
export function insertElement(parent, target){
    return parent.appendChild(target);
}

/**
 * Utility function that creates and appends an element at the same time.
 * Used when appending an element that doesn't need to be refered to later
 * @param {*} parent        The parent element
 * @param {*} type          Type of element
 * @param {*} classList     If not null, adds 1 or more classes
 * @param {*} content       Adds text content
 * @returns 
 */
export function addNewElement(parent, type, classList = [], content) {
    return insertElement(parent, createElement(type, classList, content));
}


/*
This function creates an input element,
defines its type, id, and placeholder,
and finally appends it to parent element
*/
export function createInput(parent, type, id, placeholder, required) {
    const input = document.createElement("input");
    input.type = type;
    input.id = id;
    input.placeholder = placeholder;
    if (required) {
        input.required = true;
    }
    parent.appendChild(input);
    return input;
}



export function showSpinner(parent) {
    addNewElement(parent, "div", ["loading-spinner"]);
}

export function hideSpinner(parent) {
    parent.querySelector(".loading-spinner")?.remove();
}


