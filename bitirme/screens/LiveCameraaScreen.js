import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';

const API_URL = 'http://172.20.10.4:5000/lane-video';  // Flask tarafındaki route ile aynı olmalı

export default function VideoProcessor() {
  const [videoUri, setVideoUri] = useState(null);
  const [processedUri, setProcessedUri] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const processedVideoRef = useRef(null);

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') throw new Error('Galeri izni verilmedi.');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 1,
        allowsEditing: false,
        videoExportPreset: ImagePicker.VideoExportPreset.H264_640x480
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      const fileInfo = await FileSystem.getInfoAsync(result.assets[0].uri);
      if (fileInfo.size > 50 * 1024 * 1024) throw new Error('Video 50MB sınırını aşıyor.');

      setVideoUri(result.assets[0].uri);
      setProcessedUri(null);
      setError(null);
    } catch (e) {
      setError(e.message);
      Alert.alert('Hata', e.message);
    }
  };

  const processVideo = async () => {
    if (!videoUri) {
      Alert.alert('Uyarı', 'Lütfen önce bir video seçin.');
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setError(null);

    try {
      const base64Data = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await axios.post(API_URL, { video: base64Data }, {
        timeout: 300000, // 5 dakika
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percent);
        }
      });

      if (!response.data || !response.data.processed_video) {
        throw new Error('İşlenmiş video alınamadı.');
      }

      const outputPath = `${FileSystem.cacheDirectory}processed_${Date.now()}.mp4`;
      await FileSystem.writeAsStringAsync(outputPath, response.data.processed_video, {
        encoding: FileSystem.EncodingType.Base64
      });

      setProcessedUri(outputPath);
      Alert.alert('Başarılı', `${response.data.frames_processed || 0} kare işlendi`);
    } catch (err) {
      console.error(err);
      const message = err?.response?.data?.error || err.message || 'İşleme sırasında hata oluştu';
      setError(message);
      Alert.alert('İşleme Hatası', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Şerit Tespiti Segmentasyon</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={pickVideo} disabled={isLoading}>
          <Text style={styles.buttonText}>Video Seç</Text>
        </TouchableOpacity>

        {videoUri && (
          <>
            <Text style={styles.sectionTitle}>Orijinal Video</Text>
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={styles.video}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping
            />
            <TouchableOpacity style={[styles.button, { backgroundColor: '#4CAF50' }]} onPress={processVideo}>
              <Text style={styles.buttonText}>Videoyu İşle</Text>
            </TouchableOpacity>
          </>
        )}

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.progressText}>İşleniyor: %{progress}</Text>
          </View>
        )}

        {processedUri && (
          <>
            <Text style={styles.sectionTitle}>İşlenmiş Video</Text>
            <Video
              ref={processedVideoRef}
              source={{ uri: processedUri }}
              style={styles.video}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping
            />
          </>
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
    padding: 20, 
    backgroundColor: '#f5f5f5', 
    alignItems: 'center' 
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 5,
    color: '#444',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 10,
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
  video: {
    width: '100%',
    height: 200,
    marginVertical: 10,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  loadingContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  progressText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  error: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  },
});
