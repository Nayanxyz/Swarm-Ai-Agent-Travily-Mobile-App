import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';

export default function App() {
  const [messages, setMessages] = useState([
    { id: '1', text: 'Hello Nayan! Mera naam Jango hai, Kya seva kr skta hu?', sender: 'ai' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // --- ADMIN UPLOAD STATE ---
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [uploadContent, setUploadContent] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const scrollViewRef = useRef(null);

  // --- THE DYNAMIC UPLOAD FUNCTION ---
  const handleUploadSubmit = async () => {
    if (!uploadContent.trim() || !adminPassword.trim()) {
      Alert.alert("Error", "Content and Password are required.");
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch("https://swarm-api-super-agent-travily.onrender.com/upload-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_password: adminPassword,
          content: uploadContent
        })
      });
      const result = await response.json();
      
      if (response.ok && result.status === 'success') {
        Alert.alert("Success", "Knowledge secured in vault.");
        setUploadContent('');
        setAdminPassword('');
        setIsModalVisible(false); 
      } else {
        Alert.alert("Upload Failed", result.message || "Unauthorized.");
      }
    } catch (error) {
      Alert.alert("Network Error", "Could not reach the server.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async () => {
    if (inputText.trim() === '') return; 

    const userMessageText = inputText;
    const newUserMsg = { id: Date.now().toString(), text: userMessageText, sender: 'user' };
    
    setMessages((prevMessages) => [...prevMessages, newUserMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch('https://swarm-api-super-agent-travily.onrender.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: 'nayan_mobile', 
          prompt: userMessageText 
        }),
      });

      const data = await response.json();
      const newAiMsg = { 
        id: Date.now().toString(), 
        text: data.final_answer || "Sorry, koi text nahi mila.", 
        sender: 'ai' 
      };
      setMessages((prevMessages) => [...prevMessages, newAiMsg]);

    } catch (error) {
      const errorMsg = { id: Date.now().toString(), text: "Sorry bhai, server se connection toot gaya! 🔌", sender: 'ai' };
      setMessages((prevMessages) => [...prevMessages, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
      >   
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerText}>Swarm AI 🧠</Text>
          <TouchableOpacity 
            style={styles.headerAdminButton} 
            onPress={() => setIsModalVisible(true)}
          >
            <Text style={styles.headerAdminText}>⚙️ Vault</Text>
          </TouchableOpacity>
        </View>

        {/* CHAT AREA */}
        <ScrollView 
          style={styles.chatArea}
          ref={scrollViewRef}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg) => (
            <View key={msg.id} style={msg.sender === 'user' ? styles.userBubble : styles.aiBubble}>
              <Text style={msg.sender === 'user' ? styles.userText : styles.aiText}>
                {msg.text}
              </Text>
            </View>
          ))}
          
          {isLoading && (
            <View style={styles.loadingBubble}>
              <ActivityIndicator size="small" color="#bd93f9" />
              <Text style={styles.loadingText}>Jango soch raha hai...</Text>
            </View>
          )}
        </ScrollView>

        {/* INPUT AREA */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.inputBox}
            placeholder="Type your message..."
            placeholderTextColor="#888"
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={isLoading}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* --- ADMIN VAULT MODAL --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Knowledge Vault</Text>
            
            {/* UPDATED: Added a clear heading for the content box */}
            <Text style={styles.inputLabel}>Document Content:</Text>
            <TextInput
              style={[styles.modalInputBox, styles.modalTextArea]}
              placeholder="Paste company data, facts, or rules here..."
              placeholderTextColor="#bfbfbf"
              multiline={true}
              numberOfLines={6}
              textAlignVertical="top" // Forces text to start at the top on Android
              secureTextEntry={false} // GUARANTEES words, not dots
              value={uploadContent}
              onChangeText={setUploadContent}
            />
            
            {/* UPDATED: Added a clear heading for the password box */}
            <Text style={styles.inputLabel}>Admin Password:</Text>
            <TextInput
              style={styles.modalInputBox}
              placeholder="Enter password..."
              placeholderTextColor="#bfbfbf"
              secureTextEntry={false} // FALSE = Shows words. TRUE = Shows dots.
              value={adminPassword}
              onChangeText={setAdminPassword}
            />

            {isUploading ? (
              <ActivityIndicator size="large" color="#bd93f9" style={{ marginVertical: 10 }} />
            ) : (
              <View style={styles.modalButtonRow}>
                <TouchableOpacity 
                  style={[styles.sendButton, { backgroundColor: '#ff5555' }]} 
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text style={styles.sendText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.sendButton, { backgroundColor: '#50fa7b' }]} 
                  onPress={handleUploadSubmit}
                >
                  <Text style={[styles.sendText, { color: '#282a36' }]}>Submit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// === STYLESHEET ===
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e1e2e' },
  keyboardAvoid: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#282a36',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerAdminButton: { backgroundColor: '#44475a', padding: 8, borderRadius: 5 },
  headerAdminText: { color: '#f8f8f2', fontSize: 14 },
  chatArea: { flex: 1, padding: 15 },
  aiBubble: { backgroundColor: '#383a59', padding: 15, borderRadius: 10, marginBottom: 10, alignSelf: 'flex-start', maxWidth: '80%' },
  aiText: { color: '#fff', fontSize: 16 },
  userBubble: { backgroundColor: '#ff79c6', padding: 15, borderRadius: 10, marginBottom: 10, alignSelf: 'flex-end', maxWidth: '80%' },
  userText: { color: '#fff', fontSize: 16 },
  loadingBubble: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#383a59', padding: 10, borderRadius: 10, marginBottom: 10, alignSelf: 'flex-start' },
  loadingText: { color: '#bd93f9', marginLeft: 8, fontStyle: 'italic' },
  inputArea: { flexDirection: 'row', padding: 10, backgroundColor: '#282a36', alignItems: 'center' },
  inputBox: { flex: 1, backgroundColor: '#1e1e2e', color: '#fff', padding: 12, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: '#44475a' },
  sendButton: { backgroundColor: '#bd93f9', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, marginLeft: 10, justifyContent: 'center', alignItems: 'center' },
  sendText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalView: { width: '90%', backgroundColor: '#282a36', borderRadius: 20, padding: 25, alignItems: 'stretch', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  
  // Dedicated style for Modal inputs to force visibility against Dark Mode
  modalInputBox: { 
    backgroundColor: '#44475a', 
    color: '#f8f8f2',           
    padding: 12, 
    borderRadius: 10, 
    fontSize: 16, 
    borderWidth: 1, 
    borderColor: '#6272a4' 
  },
  
  modalTextArea: { height: 140, textAlignVertical: 'top', marginBottom: 20 }, 
  inputLabel: { color: '#bd93f9', fontSize: 14, fontWeight: 'bold', marginBottom: 8, marginLeft: 5 }, 
  modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }
});