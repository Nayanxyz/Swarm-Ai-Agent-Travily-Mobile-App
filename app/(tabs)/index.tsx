import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView, Platform,
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
  
  // 1. Naya State: Loading dikhane ke liye
  const [isLoading, setIsLoading] = useState(false);
  
  // Auto-scroll ke liye ek reference
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSend = async () => {
    if (inputText.trim() === '') return; 

    const userMessageText = inputText;
    const newUserMsg = { id: Date.now().toString(), text: userMessageText, sender: 'user' };
    
    setMessages((prevMessages) => [...prevMessages, newUserMsg]);
    setInputText('');
    
    // 2. Button dabte hi loading shuru karo
    setIsLoading(true);

    try {
      // DHYAN DEIN: Apna Render URL confirm kar lena
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
      console.error("API Error:", error);
      const errorMsg = { id: Date.now().toString(), text: "Sorry bhai, server se connection toot gaya! 🔌", sender: 'ai' };
      setMessages((prevMessages) => [...prevMessages, errorMsg]);
    } finally {
      // 3. Jawab aate hi (ya error aate hi) loading band karo
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 4. KEYBOARD AVOIDING VIEW ka jaadu */}
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
      >   
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerText}>Swarm AI 🧠</Text>
        </View>

        {/* CHAT AREA */}
        <ScrollView 
          style={styles.chatArea}
          ref={scrollViewRef}
          // Jab naya message aaye, toh automatically neeche scroll ho jaye
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg) => (
            <View key={msg.id} style={msg.sender === 'user' ? styles.userBubble : styles.aiBubble}>
              <Text style={msg.sender === 'user' ? styles.userText : styles.aiText}>
                {msg.text}
              </Text>
            </View>
          ))}
          
          {/* 5. LOADING ANIMATION (Sirf tab dikhega jab isLoading True hoga) */}
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
            onChangeText={(text) => setInputText(text)}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={isLoading}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadButton} onPress={handleSend} disabled={isLoading}>
            <Text style={styles.sendText}>Upload</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// === STYLESHEET ===
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e2e', 
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#282a36',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatArea: {
    flex: 1,
    padding: 15,
  },
  aiBubble: {
    backgroundColor: '#383a59',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  aiText: {
    color: '#fff',
    fontSize: 16,
  },
  userBubble: {
    backgroundColor: '#ff79c6', 
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  userText: {
    color: '#fff',
    fontSize: 16,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#383a59',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  loadingText: {
    color: '#bd93f9',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  inputArea: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#282a36',
    alignItems: 'center',
  },
  inputBox: {
    flex: 1,
    backgroundColor: '#1e1e2e',
    color: '#fff',
    padding: 12,
    borderRadius: 25,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#bd93f9',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginLeft: 10,
  }, 
  uploadButton: {
    backgroundColor: '#bd93f9',
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 25,
    marginLeft: 10,
  },
  sendText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});