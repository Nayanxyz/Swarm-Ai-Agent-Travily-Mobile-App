import { Session } from '@supabase/supabase-js';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { supabase } from './supabase'; // Ensure this path points to the file you created in Step 2

export default function App() {
  // --- AUTH STATE ---
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // --- CHAT STATE ---
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

  const scrollViewRef = useRef<ScrollView>(null);

// === 1. BOOT SEQUENCE: CHECK FOR SAVED LOGIN ===
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
      // THE ARCHITECTURAL FIX: Wiping the phone's local RAM on logout
      if (!session) {
        setMessages([
          { id: '1', text: 'Hello User! Mera naam Jango hai, Kya seva kr skta hu?', sender: 'ai' }
        ]);
        setInputText(''); // Clear the input box just in case
      }
    });
  }, []);

  // === 2. AUTHENTICATION FUNCTIONS ===
  async function signInWithEmail() {
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Login Failed', error.message);
    setAuthLoading(false);
  }

  async function signUpWithEmail() {
    setAuthLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) Alert.alert('Signup Failed', error.message);
    else Alert.alert('Success', 'Account created! You are now logged in.');
    setAuthLoading(false);
  }

  // === 3. THE DYNAMIC UPLOAD FUNCTION ===
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
          user_id: session?.user?.id, // ARCHITECTURAL FIX: Attaching the real UUID to the vault upload
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

  // === 4. CHAT SEND FUNCTION ===
  const handleSend = async () => {
    if (inputText.trim() === '' || !session?.user) return; 

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
          user_id: session.user.id, // ARCHITECTURAL FIX: Passing cryptographic UUID to the brain
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

  // ==========================================
  // RENDER 1: LOGIN SCREEN (If user is not logged in)
  // ==========================================
  if (!session || !session.user) {
    return (
      <View style={styles.authContainer}>
        <Text style={styles.authTitle}>Welcome !</Text>
        <Text style={styles.authSubtitle}>Sign in to access your secure vault.</Text>
        
        <TextInput
          style={styles.authInput}
          placeholder="Email address"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.authInput}
          placeholder="Password (min 6 chars)"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={true}
        />
        
        <TouchableOpacity style={styles.primaryBtn} onPress={signInWithEmail} disabled={authLoading}>
          <Text style={styles.btnText}>{authLoading ? 'Loading...' : 'Sign In'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.secondaryBtn} onPress={signUpWithEmail} disabled={authLoading}>
          <Text style={styles.secondaryBtnText}>Create Account</Text>
        </TouchableOpacity>
        <Text style={styles.authSubtitle}>create account if new user.</Text>
      </View>
    );
  }

  // ==========================================
  // RENDER 2: CHAT SCREEN (If user is logged in)
  // ==========================================
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              style={[styles.headerAdminButton, { marginRight: 10 }]} 
              onPress={() => setIsModalVisible(true)}
            >
              <Text style={styles.headerAdminText}>⚙️ Vault</Text>
            </TouchableOpacity>
            
            {/* NEW: Logout Button */}
            <TouchableOpacity 
              style={[styles.headerAdminButton, { backgroundColor: '#ff5555' }]} 
              onPress={() => supabase.auth.signOut()}
            >
              <Text style={styles.headerAdminText}>Logout</Text>
            </TouchableOpacity>
          </View>
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
            
            <Text style={styles.inputLabel}>Document Content:</Text>
            <TextInput
              style={[styles.modalInputBox, styles.modalTextArea]}
              placeholder="Paste company data, facts, or rules here..."
              placeholderTextColor="#bfbfbf"
              multiline={true}
              numberOfLines={6}
              textAlignVertical="top" 
              secureTextEntry={false} 
              value={uploadContent}
              onChangeText={setUploadContent}
            />
            
            <Text style={styles.inputLabel}>Admin Password:</Text>
            <TextInput
              style={styles.modalInputBox}
              placeholder="Enter password..."
              placeholderTextColor="#bfbfbf"
              secureTextEntry={false} 
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
  // Chat Styles
  container: { flex: 1, backgroundColor: '#1e1e2e' },
  keyboardAvoid: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 50, backgroundColor: '#282a36', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#444' },
  headerText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerAdminButton: { backgroundColor: '#44475a', padding: 8, borderRadius: 5 },
  headerAdminText: { color: '#f8f8f2', fontSize: 14, fontWeight: 'bold' },
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
  modalInputBox: { backgroundColor: '#44475a', color: '#f8f8f2', padding: 12, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: '#6272a4' },
  modalTextArea: { height: 140, textAlignVertical: 'top', marginBottom: 20 }, 
  inputLabel: { color: '#bd93f9', fontSize: 14, fontWeight: 'bold', marginBottom: 8, marginLeft: 5 }, 
  modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },

  // Auth Styles
  authContainer: { flex: 1, backgroundColor: '#1e1e2e', justifyContent: 'center', padding: 20 },
  authTitle: { color: '#fff', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  authSubtitle: { color: '#888', fontSize: 16, textAlign: 'center', marginBottom: 40 },
  authInput: { backgroundColor: '#282a36', color: '#fff', padding: 15, borderRadius: 10, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#44475a' },
  primaryBtn: { backgroundColor: '#bd93f9', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  secondaryBtn: { padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  secondaryBtnText: { color: '#bd93f9', fontSize: 16, fontWeight: 'bold' }
});