import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
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

      const response = await fetch('http://172.20.10.4:5000/lane-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const data = await response.json();

      if (data.result) {
        setImage(`data:image/jpeg;base64,${data.result}`);
      } else {
        Alert.alert('Hata', data.error || 'Beklenmeyen bir hata oluştu');
      }
    } catch (error) {
      console.error('API Hatası:', error);
      Alert.alert('Hata', 'Sunucu ile iletişim kurulamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Şerit Tespiti</Text>

        <TouchableOpacity style={styles.button} onPress={pickImage} disabled={loading}>
          <Text style={styles.buttonText}>Fotoğraf Seç ve Gönder</Text>
        </TouchableOpacity>

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>İşleniyor...</Text>
          </View>
        )}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 40,
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#F9FAFB',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1C1C1E',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loading: {
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  zoomContainer: {
    width: '100%',
    height: 450,
    marginTop: 10,
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
