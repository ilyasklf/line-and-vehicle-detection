import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ImagePickerScreen from './screens/ImagePickerScreen';
import CameraCaptureScreen from './screens/CameraCaptureScreen';
import LiveCameraScreen from './screens/LiveCameraScreen';
import LiveCameraaScreen from './screens/LiveCameraaScreen';

import BirPhotoScreen from './screens/BirPhotoScreen';
import BirVideoScreen from './screens/BirVideoScreen';


const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Araç Fotoğraf Seç" component={ImagePickerScreen} />
        <Tab.Screen name="Araç Video Seç" component={CameraCaptureScreen} />
        <Tab.Screen name="Şerit Fotoğraf Seç" component={LiveCameraScreen} />
        <Tab.Screen name="Şerit Video Seç" component={LiveCameraaScreen} />


        <Tab.Screen name="Ortak Fotoğraf Seç" component={BirPhotoScreen} />
        <Tab.Screen name="Ortak Video Seç" component={BirVideoScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
