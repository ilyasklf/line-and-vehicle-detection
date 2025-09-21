import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Button, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';

const API_URL = 'http://172.20.10.4:5000/vehicle-video'; // BURAYI KENDİ FLASK SUNUCUNA GÖRE AYARLA

export default function App() {
  const [videoUri, setVideoUri] = useState(null);
  const [processedUri, setProcessedUri] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (processedUri && scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [processedUri]);

  const validateVideo = async (uri) => {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) throw new Error('Video bulunamadı');
    if (info.size > 50 * 1024 * 1024) throw new Error('Video boyutu 50MB’dan büyük');
    const ext = uri.split('.').pop()?.toLowerCase();
    if (!['mp4', 'mov'].includes(ext)) throw new Error('Sadece MP4 veya MOV dosyası desteklenir');
  };

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') throw new Error('Galeri izni reddedildi');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const uri = result.assets[0].uri;
        await validateVideo(uri);
        setVideoUri(uri);
        setProcessedUri(null);
      }
    } catch (err) {
      Alert.alert('Hata', err.message || 'Bilinmeyen hata');
    }
  };

  const processVideo = async () => {
    try {
      if (!videoUri) throw new Error('Lütfen önce bir video seçin');

      const { isConnected } = await NetInfo.fetch();
      if (!isConnected) throw new Error('İnternet bağlantısı yok');

      setIsLoading(true);
      setProgress(0);

      const base64 = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await axios.post(API_URL, { video: base64 }, {
        timeout: 600000, // 10 dakika
        onUploadProgress: (e) => {
          if (e.total) {
            setProgress(Math.round((e.loaded * 100) / e.total));
          }
        },
      });

      const data = response.data;
      if (!data?.processed_video) throw new Error(data?.error || 'Sunucu hatası');

      const savedPath = `${FileSystem.cacheDirectory}processed_${Date.now()}.mp4`;
      await FileSystem.writeAsStringAsync(savedPath, data.processed_video, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setProcessedUri(savedPath);
    } catch (err) {
      const message = err?.message || 'İşleme sırasında hata';
      Alert.alert('Hata', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Araç ve Şerit Tespiti</Text>

      <Button title="Video Seç" onPress={pickVideo} disabled={isLoading} />

      {videoUri && (
        <View style={{ marginVertical: 20 }}>
          <Text>Orijinal Video:</Text>
          <Video
            source={{ uri: videoUri }}
            style={{ width: '100%', height: 200 }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping
          />
          <Button title="İşle" onPress={processVideo} disabled={isLoading} />
        </View>
      )}

      {isLoading && (
        <View style={{ marginVertical: 20 }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 10 }}>İşleniyor... %{progress}</Text>
        </View>
      )}

      {processedUri && (
        <View style={{ marginVertical: 20 }}>
          <Text>İşlenmiş Video:</Text>
          <Video
            source={{ uri: processedUri }}
            style={{ width: '100%', height: 200 }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping
          />
        </View>
      )}
    </ScrollView>
  );
}
