
/* 
This function creates an element, 
defines its type, assigns it with one or more classes (optional), 
and adds content (optional), 
and finally appends it to parent element 
*/
export function createElement(parent, type, classList = [], content) {
    const element = document.createElement(type);
    if (classList.length > 0) {
        element.classList.add(...classList);
    }
    if (content) {
        element.textContent = content;
    }
    parent.appendChild(element);
    return element;
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



// Utility function to add styles, classes, and attributes to an element
// With this function we reduce the need for multiple lines of code every time we want to style an element.
export function formatElement(element, styles = {}, classList = [], attrs = {}) {
    Object.assign(element.style, styles);
    if (classList) {
        element.classList.add(...classList);
    }
    Object.assign(element, attrs);
}



export function showSpinner(parent) {
    createElement(parent, "div", ["loading-spinner"]);
}

export function hideSpinner(parent) {
    parent.querySelector(".loading-spinner")?.remove();
}

export function insertElement(parent, target){
    return parent.appendChild(target);
}
