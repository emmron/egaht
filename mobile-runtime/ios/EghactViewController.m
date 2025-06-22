/**
 * Eghact View Controller for iOS
 * Main entry point for iOS apps using Eghact runtime
 */

#import <UIKit/UIKit.h>
#include "../src/core.h"

@interface EghactViewController : UIViewController
@property (nonatomic, assign) EghactRuntime* runtime;
@property (nonatomic, assign) Component* rootComponent;
@end

@implementation EghactViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    
    // Initialize Eghact runtime
    self.runtime = eghact_init();
    
    // Create the app UI
    self.rootComponent = [self createAppUI];
    
    // Set view background
    self.view.backgroundColor = [UIColor whiteColor];
    
    // Add root component to view
    if (self.rootComponent && self.rootComponent->native_handle) {
        UIView* rootView = (__bridge UIView*)self.rootComponent->native_handle;
        [self.view addSubview:rootView];
    }
}

- (Component*)createAppUI {
    // This is where the app would create its UI
    // For now, create a simple test UI
    
    Component* root = eghact_create_view();
    eghact_set_size(root, self.view.bounds.size.width, self.view.bounds.size.height);
    eghact_set_background_color(root, EGHACT_COLOR_WHITE);
    
    Component* title = eghact_create_text("Eghact iOS App");
    eghact_set_position(title, 20, 100);
    eghact_set_size(title, self.view.bounds.size.width - 40, 40);
    eghact_set_font_size(title, 24);
    eghact_add_child(root, title);
    
    Component* info = eghact_create_text("Native iOS - No React Native!");
    eghact_set_position(info, 20, 150);
    eghact_set_size(info, self.view.bounds.size.width - 40, 30);
    eghact_set_font_size(info, 16);
    eghact_set_text_color(info, EGHACT_COLOR_RGB(100, 100, 100));
    eghact_add_child(root, info);
    
    return root;
}

- (void)viewDidLayoutSubviews {
    [super viewDidLayoutSubviews];
    
    // Update root component size on layout changes
    if (self.rootComponent) {
        eghact_set_size(self.rootComponent, 
                       self.view.bounds.size.width, 
                       self.view.bounds.size.height);
    }
}

- (void)dealloc {
    if (self.runtime) {
        eghact_shutdown();
    }
}

@end

// App Delegate for standalone apps
@interface EghactAppDelegate : UIResponder <UIApplicationDelegate>
@property (strong, nonatomic) UIWindow *window;
@end

@implementation EghactAppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
    
    EghactViewController *viewController = [[EghactViewController alloc] init];
    self.window.rootViewController = viewController;
    
    [self.window makeKeyAndVisible];
    
    return YES;
}

@end