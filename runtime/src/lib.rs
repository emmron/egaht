use wasm_bindgen::prelude::*;
use web_sys::{Document, Element, Event, HtmlElement, Node, Text, Window};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
pub struct EghactRuntime {
    document: Document,
}

#[wasm_bindgen]
impl EghactRuntime {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<EghactRuntime, JsValue> {
        let window = web_sys::window().ok_or("No window object")?;
        let document = window.document().ok_or("No document object")?;
        
        Ok(EghactRuntime { document })
    }

    #[wasm_bindgen(js_name = createElement)]
    pub fn create_element(&self, tag_name: &str) -> Result<Element, JsValue> {
        self.document.create_element(tag_name)
    }

    #[wasm_bindgen(js_name = createTextNode)]
    pub fn create_text_node(&self, text: &str) -> Text {
        self.document.create_text_node(text)
    }

    #[wasm_bindgen(js_name = appendChild)]
    pub fn append_child(&self, parent: &Node, child: &Node) -> Result<Node, JsValue> {
        parent.append_child(child)
    }

    #[wasm_bindgen(js_name = removeChild)]
    pub fn remove_child(&self, parent: &Node, child: &Node) -> Result<Node, JsValue> {
        parent.remove_child(child)
    }

    #[wasm_bindgen(js_name = insertBefore)]
    pub fn insert_before(&self, parent: &Node, new_child: &Node, reference: Option<&Node>) -> Result<Node, JsValue> {
        parent.insert_before(new_child, reference)
    }

    #[wasm_bindgen(js_name = setAttribute)]
    pub fn set_attribute(&self, element: &Element, name: &str, value: &str) -> Result<(), JsValue> {
        element.set_attribute(name, value)
    }

    #[wasm_bindgen(js_name = removeAttribute)]
    pub fn remove_attribute(&self, element: &Element, name: &str) -> Result<(), JsValue> {
        element.remove_attribute(name)
    }

    #[wasm_bindgen(js_name = setText)]
    pub fn set_text(&self, node: &Text, text: &str) {
        node.set_data(text);
    }

    #[wasm_bindgen(js_name = setProperty)]
    pub fn set_property(&self, element: &Element, prop: &str, value: &JsValue) -> Result<(), JsValue> {
        use wasm_bindgen::JsCast;
        let obj = element.dyn_ref::<js_sys::Object>()
            .ok_or("Element is not an object")?;
        js_sys::Reflect::set(obj, &JsValue::from_str(prop), value)?;
        Ok(())
    }

    #[wasm_bindgen(js_name = addEventListener)]
    pub fn add_event_listener(&self, element: &Element, event_type: &str, callback: &js_sys::Function) -> Result<(), JsValue> {
        element.add_event_listener_with_callback(event_type, callback)?;
        Ok(())
    }

    #[wasm_bindgen(js_name = removeEventListener)]
    pub fn remove_event_listener(&self, element: &Element, event_type: &str, callback: &js_sys::Function) -> Result<(), JsValue> {
        element.remove_event_listener_with_callback(event_type, callback)?;
        Ok(())
    }

    #[wasm_bindgen(js_name = getElementById)]
    pub fn get_element_by_id(&self, id: &str) -> Option<Element> {
        self.document.get_element_by_id(id)
    }

    #[wasm_bindgen(js_name = querySelector)]
    pub fn query_selector(&self, selector: &str) -> Result<Option<Element>, JsValue> {
        self.document.query_selector(selector)
    }

    /// XSS Protection: Escape HTML content to prevent script injection
    #[wasm_bindgen(js_name = escapeHtml)]
    pub fn escape_html(&self, input: &str) -> String {
        input
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&#x27;")
            .replace('/', "&#x2F;")
    }

    /// XSS Protection: Set text content with automatic escaping
    #[wasm_bindgen(js_name = setTextContent)]
    pub fn set_text_content(&self, element: &Element, text: &str) -> Result<(), JsValue> {
        let escaped_text = self.escape_html(text);
        element.set_text_content(Some(&escaped_text));
        Ok(())
    }

    /// XSS Protection: Set raw HTML content (use with caution - only for trusted content)
    #[wasm_bindgen(js_name = setInnerHTML)]
    pub fn set_inner_html(&self, element: &Element, html: &str) -> Result<(), JsValue> {
        element.set_inner_html(html);
        Ok(())
    }

    /// XSS Protection: Secure URL attribute setting with validation
    #[wasm_bindgen(js_name = setSecureUrlAttribute)]
    pub fn set_secure_url_attribute(&self, element: &Element, name: &str, url: &str) -> Result<(), JsValue> {
        // Validate URL to prevent javascript: and data: URLs in href/src attributes
        let safe_url = if self.is_safe_url(url) {
            url.to_string()
        } else {
            // Replace unsafe URLs with empty string or safe placeholder
            console_log!("Warning: Unsafe URL blocked: {}", url);
            String::new()
        };
        
        element.set_attribute(name, &safe_url)
    }

    /// XSS Protection: Validate URLs to prevent dangerous schemes
    #[wasm_bindgen(js_name = isSafeUrl)]
    pub fn is_safe_url(&self, url: &str) -> bool {
        let url_lower = url.trim().to_lowercase();
        
        // Block dangerous schemes
        if url_lower.starts_with("javascript:") 
            || url_lower.starts_with("data:") 
            || url_lower.starts_with("vbscript:")
            || url_lower.starts_with("file:")
            || url_lower.starts_with("about:") {
            return false;
        }
        
        // Allow safe schemes and relative URLs
        url_lower.starts_with("http://") 
            || url_lower.starts_with("https://") 
            || url_lower.starts_with("//")
            || url_lower.starts_with("/")
            || url_lower.starts_with("./")
            || url_lower.starts_with("../")
            || url_lower.starts_with("#")
            || url_lower.starts_with("?")
            || (!url_lower.contains(':') && !url_lower.starts_with("//"))
    }

    /// XSS Protection: Set attribute with escaping for non-URL attributes
    #[wasm_bindgen(js_name = setSecureAttribute)]
    pub fn set_secure_attribute(&self, element: &Element, name: &str, value: &str) -> Result<(), JsValue> {
        let escaped_value = self.escape_html(value);
        element.set_attribute(name, &escaped_value)
    }
}

#[wasm_bindgen(start)]
pub fn main() {
    console_log!("Eghact runtime initialized");
}