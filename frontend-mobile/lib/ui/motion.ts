import { Easing, Platform } from 'react-native';

const softEase = Easing.bezier(0.22, 1, 0.36, 1);
const snappyEase = Easing.bezier(0.2, 0.8, 0.2, 1);
const defaultEase = Easing.out(Easing.cubic);

export const motionTokens = {
  easing: {
    default: defaultEase,
    soft: softEase,
    snappy: snappyEase,
  },
  fade: {
    patient: { duration: 260, fromY: 6, easing: softEase },
    patientSection: { duration: 260, fromY: 10, easing: softEase },
    patientSectionLong: { duration: 280, fromY: 12, easing: softEase },
    patientRecord: { duration: 260, fromY: 6, easing: softEase },
    listPatient: { duration: 260, fromY: 8, easing: softEase },
    doctor: { duration: 220, fromY: 4, easing: snappyEase },
    doctorSection: { duration: 210, fromY: 8, easing: snappyEase },
    doctorItem: { duration: 200, fromY: 10, easing: snappyEase },
    listDoctor: { duration: 220, fromY: 8, easing: snappyEase },
  },
  nav: {
    rootStack: {
      headerShown: false,
      animation: Platform.OS === 'ios' ? 'simple_push' : 'fade_from_bottom',
      gestureEnabled: true,
      fullScreenGestureEnabled: Platform.OS === 'ios',
      animationMatchesGesture: Platform.OS === 'ios',
    },
    softPush: {
      animation: 'fade_from_bottom',
      gestureEnabled: true,
      fullScreenGestureEnabled: Platform.OS === 'ios',
      animationMatchesGesture: Platform.OS === 'ios',
    },
    snappyPush: {
      animation: 'slide_from_right',
      gestureEnabled: true,
      fullScreenGestureEnabled: Platform.OS === 'ios',
      animationMatchesGesture: Platform.OS === 'ios',
    },
    modal: {
      presentation: 'modal',
      animation: Platform.OS === 'ios' ? 'slide_from_bottom' : 'fade_from_bottom',
      gestureEnabled: true,
    },
    authStack: {
      headerShown: false,
      animation: Platform.OS === 'ios' ? 'fade' : 'fade_from_bottom',
      gestureEnabled: Platform.OS === 'ios',
    },
    newRequestStack: {
      headerShown: false,
      animation: 'fade_from_bottom',
      gestureEnabled: true,
      animationMatchesGesture: true,
    },
  },
} as const;

