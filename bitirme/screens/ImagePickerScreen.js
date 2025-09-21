import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

export default function App() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const optimizeImage = async (uri) => {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 640 } }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );
      return manipulated.uri;
    } catch (e) {
      console.log("Görsel optimize edilemedi:", e);
      return uri;
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      const optimizedUri = await optimizeImage(result.assets[0].uri);
      setImage(optimizedUri);
      sendToFlask(optimizedUri);
    }
  };

  const sendToFlask = async (uri) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', {
        uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });

      const response = await fetch('http://172.20.10.4:5000/vehicle-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const data = await response.json();

      if (data.image) {
        setImage(`data:image/png;base64,${data.image}`);
      } else {
        Alert.alert('Hata', data.error || 'Beklenmeyen bir hata oluştu');
      }
    } catch (error) {
      Alert.alert('Hata', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={pickImage}>
        <Text style={styles.buttonText}>Fotoğraf Seç ve Gönder</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />}

      {image && !loading && (
        <ScrollView
          maximumZoomScale={3}
          minimumZoomScale={1}
          style={styles.zoomContainer}
          contentContainerStyle={styles.zoomContent}
        >
          <Image source={{ uri: image }} style={styles.image} resizeMode="contain" />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  zoomContainer: {
    width: '100%',
    height: 450,
    marginTop: 25,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
  },
  zoomContent: {
    flexGrow: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
