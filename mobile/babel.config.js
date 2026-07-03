module.exports = function (api) {
  api.cache(true);
  // Under Jest we skip NativeWind's JSX transform: `className` then becomes a
  // plain (ignored) prop, so screens render in jsdom without the CSS runtime.
  const isTest = process.env.NODE_ENV === "test";
  return {
    presets: [
      ["babel-preset-expo", isTest ? {} : { jsxImportSource: "nativewind" }],
      ...(isTest ? [] : ["nativewind/babel"]),
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
