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
}

#[wasm_bindgen(start)]
pub fn main() {
    console_log!("Eghact runtime initialized");
}