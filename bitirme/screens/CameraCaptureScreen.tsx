import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';

const API_URL = 'http://172.20.10.4:5000/vehicle-video';

interface AppState {
  videoUri: string | null;
  processedUri: string | null;
  isLoading: boolean;
  progress: number;
  error: string | null;
}

const initialState: AppState = {
  videoUri: null,
  processedUri: null,
  isLoading: false,
  progress: 0,
  error: null
};

const validateVideo = async (uri: string): Promise<void> => {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error('Dosya mevcut değil');
  if (info.size && info.size > 50 * 1024 * 1024)
    throw new Error('Dosya çok büyük (maks. 50MB)');
  const extension = uri.split('.').pop()?.toLowerCase();
  if (!extension || !['mp4', 'mov'].includes(extension))
    throw new Error('Sadece MP4/MOV destekleniyor');
};

export default function VideoProcessor() {
  const [state, setState] = useState<AppState>(initialState);

  const updateState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') throw new Error('İzin reddedildi');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 1,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      await validateVideo(result.assets[0].uri);
      updateState({ videoUri: result.assets[0].uri, processedUri: null, error: null });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      updateState({ error: errorMessage });
      Alert.alert('Hata', errorMessage);
    }
  };

  const processVideo = async () => {
    try {
      if (!state.videoUri) throw new Error('Lütfen önce bir video seçin');

      updateState({ isLoading: true, progress: 0, error: null });

      const { isConnected } = await NetInfo.fetch();
      if (!isConnected) throw new Error('İnternet bağlantısı yok');

      const base64 = await FileSystem.readAsStringAsync(state.videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const source = axios.CancelToken.source();
      const timeout = setTimeout(() => source.cancel('İstek zaman aşımına uğradı'), 600000);

      const response = await axios.post(API_URL, { video: base64 }, {
        cancelToken: source.token,
        onUploadProgress: (e) => {
          if (e.total) updateState({ progress: Math.round((e.loaded * 100) / e.total) });
        },
      });

      clearTimeout(timeout);

      if (!response.data?.processed_video)
        throw new Error(response.data?.error || 'Geçersiz yanıt');

      const path = `${FileSystem.cacheDirectory}processed_${Date.now()}.mp4`;
      await FileSystem.writeAsStringAsync(path, response.data.processed_video, {
        encoding: FileSystem.EncodingType.Base64
      });

      updateState({ processedUri: path, isLoading: false });
      Alert.alert('Başarılı', `İşlenen kare sayısı: ${response.data.frames_processed || 0}`);

    } catch (error) {
      let errorMessage = 'Bilinmeyen hata';
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.error || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      updateState({ isLoading: false, error: errorMessage });
      Alert.alert('İşleme Hatası', errorMessage);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Araç Tespiti</Text>

        {state.error && <Text style={styles.error}>{state.error}</Text>}

        <TouchableOpacity
          style={styles.button}
          onPress={pickVideo}
          disabled={state.isLoading}
        >
          <Text style={styles.buttonText}>Video Seç</Text>
        </TouchableOpacity>

        {state.videoUri && (
          <>
            <Video
              source={{ uri: state.videoUri }}
              style={styles.video}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping
            />

            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#34C759' }]}
              onPress={processVideo}
              disabled={state.isLoading}
            >
              <Text style={styles.buttonText}>Videoyu İşle</Text>
            </TouchableOpacity>
          </>
        )}

        {state.isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.progressText}>Yükleniyor: %{state.progress}</Text>
          </View>
        )}

        {state.processedUri && (
          <>
            <Text style={styles.processedLabel}>İşlenmiş Video:</Text>
            <Video
              source={{ uri: state.processedUri }}
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
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 20,
    textAlign: 'center',
  },
  error: {
    color: '#FF3B30',
    marginBottom: 10,
    textAlign: 'center',
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
    height: 220,
    marginVertical: 15,
    borderRadius: 12,
    backgroundColor: '#D1D1D6',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  progressText: {
    marginTop: 8,
    fontSize: 16,
    color: '#555',
  },
  processedLabel: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
