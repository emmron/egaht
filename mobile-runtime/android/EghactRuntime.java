package com.eghact.runtime;

import android.app.Activity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.ScrollView;
import android.widget.TextView;
import android.text.TextWatcher;
import android.text.Editable;
import android.graphics.Color;
import android.view.ViewGroup.LayoutParams;

/**
 * Eghact Runtime for Android
 * JNI bridge for native C runtime
 */
public class EghactRuntime {
    static {
        System.loadLibrary("eghact_mobile");
    }
    
    private Activity activity;
    
    public EghactRuntime(Activity activity) {
        this.activity = activity;
        nativeInit(this);
    }
    
    // Native methods
    private native void nativeInit(EghactRuntime runtime);
    private native void onButtonClick(long componentPtr);
    private native void onTextChanged(long componentPtr, String text);
    
    // View creation methods called from native
    public View createView() {
        LinearLayout view = new LinearLayout(activity);
        view.setLayoutParams(new LayoutParams(
            LayoutParams.MATCH_PARENT,
            LayoutParams.MATCH_PARENT
        ));
        return view;
    }
    
    public TextView createText(String text) {
        TextView textView = new TextView(activity);
        textView.setText(text);
        textView.setTextColor(Color.BLACK);
        return textView;
    }
    
    public ImageView createImage(String src) {
        ImageView imageView = new ImageView(activity);
        // TODO: Load image from src
        return imageView;
    }
    
    public Button createButton(String title, final long componentPtr) {
        Button button = new Button(activity);
        button.setText(title);
        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                onButtonClick(componentPtr);
            }
        });
        return button;
    }
    
    public EditText createInput(String placeholder, final long componentPtr) {
        EditText editText = new EditText(activity);
        editText.setHint(placeholder);
        editText.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {}
            
            @Override
            public void afterTextChanged(Editable s) {
                onTextChanged(componentPtr, s.toString());
            }
        });
        return editText;
    }
    
    public ScrollView createScroll() {
        return new ScrollView(activity);
    }
    
    public ListView createList() {
        return new ListView(activity);
    }
    
    // Layout and style methods
    public void updateLayout(View view, float x, float y, float width, float height) {
        LayoutParams params = view.getLayoutParams();
        if (params == null) {
            params = new LayoutParams((int)width, (int)height);
        } else {
            params.width = (int)width;
            params.height = (int)height;
        }
        view.setLayoutParams(params);
        view.setX(x);
        view.setY(y);
    }
    
    public void updateStyle(View view, Style style) {
        view.setBackgroundColor(style.backgroundColor);
        view.setAlpha(style.opacity);
        // TODO: Apply more style properties
    }
    
    public void addChild(ViewGroup parent, View child) {
        parent.addView(child);
    }
    
    public void removeChild(ViewGroup parent, View child) {
        parent.removeView(child);
    }
    
    // Style helper class
    public static class Style {
        public int backgroundColor;
        public float opacity;
        // Add more style properties as needed
    }
}