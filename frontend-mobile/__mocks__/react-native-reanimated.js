// Mock para react-native-reanimated v4 em ambiente Jest
const React = require('react');

function createAnimatedMockComponent(name) {
  const component = React.forwardRef((props, ref) => {
    return React.createElement(name, { ...props, ref });
  });
  component.displayName = `Animated.${name}`;
  return component;
}

const Animated = {
  call: () => {},
  createAnimatedComponent: (component) => component,
  addWhitelistedUIProps: () => {},
  addWhitelistedNativeProps: () => {},
  View: createAnimatedMockComponent('View'),
  Text: createAnimatedMockComponent('Text'),
  Image: createAnimatedMockComponent('Image'),
  ScrollView: createAnimatedMockComponent('ScrollView'),
  FlatList: createAnimatedMockComponent('FlatList'),
};

module.exports = {
  __esModule: true,
  default: Animated,
  useSharedValue: (init) => ({ value: init }),
  useAnimatedStyle: (fn) => fn(),
  useDerivedValue: (fn) => ({ value: fn() }),
  useAnimatedScrollHandler: () => () => {},
  useAnimatedGestureHandler: () => () => {},
  useAnimatedRef: () => ({ current: null }),
  useAnimatedReaction: () => {},
  withTiming: (toValue) => toValue,
  withSpring: (toValue) => toValue,
  withSequence: (...args) => args[args.length - 1],
  withRepeat: (animation) => animation,
  withDelay: (_, animation) => animation,
  cancelAnimation: () => {},
  runOnUI: (fn) => fn,
  runOnJS: (fn) => fn,
  interpolate: jest.fn(),
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Easing: {
    linear: (v) => v,
    ease: (v) => v,
    bezier: () => (v) => v,
    in: (fn) => fn,
    out: (fn) => fn,
    inOut: (fn) => fn,
  },
  clamp: (value, min, max) => Math.min(Math.max(value, min), max),
  FadeIn: { duration: () => ({ delay: () => ({}) }) },
  FadeOut: { duration: () => ({ delay: () => ({}) }) },
  FadeInDown: { duration: () => ({ delay: () => ({}) }) },
  FadeInUp: { duration: () => ({ delay: () => ({}) }) },
  SlideInRight: { duration: () => ({}) },
  SlideOutLeft: { duration: () => ({}) },
  Layout: { duration: () => ({}) },
  setUpTests: () => {},
};
