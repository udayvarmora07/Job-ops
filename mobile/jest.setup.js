/* Global mocks for native/router modules so screens render headlessly. */

// expo-router: stub navigation primitives with a shared spyable router.
jest.mock("expo-router", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  const passthrough = ({ children }) =>
    React.createElement(React.Fragment, null, children);
  return {
    __router: router,
    useRouter: () => router,
    useSegments: () => [],
    usePathname: () => "/",
    useLocalSearchParams: () => ({}),
    Link: ({ children, ...props }) =>
      React.createElement(Text, props, children),
    Redirect: () => null,
    Stack: Object.assign(passthrough, { Screen: () => null }),
    Tabs: Object.assign(passthrough, { Screen: () => null }),
  };
});

// safe-area-context: render children in plain Views, zero insets.
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => React.createElement(View, null, children),
    SafeAreaView: ({ children, ...props }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

// expo-secure-store: in-memory store.
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    setItemAsync: jest.fn(async (k, v) => {
      store.set(k, v);
    }),
    getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    deleteItemAsync: jest.fn(async (k) => {
      store.delete(k);
    }),
  };
});

// Silence noisy act() / animation warnings that don't affect assertions.
const origError = console.error;
console.error = (...args) => {
  const msg = typeof args[0] === "string" ? args[0] : "";
  if (msg.includes("not wrapped in act") || msg.includes("useNativeDriver")) return;
  origError(...args);
};
