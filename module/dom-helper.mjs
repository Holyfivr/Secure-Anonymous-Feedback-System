
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
        element.innerHTML = content;
    }
    parent.appendChild(element);
    return element;
}
