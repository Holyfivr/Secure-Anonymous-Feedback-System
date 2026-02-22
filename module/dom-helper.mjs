
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


// Intended to be a helper for inserting divs with specific styles, but not fully implemented yet
export function insertDiv(classList = [], id, layout, heightVal, widthVal, marginVal,  ) {

}
