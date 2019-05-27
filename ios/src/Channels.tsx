import AsyncStorage from '@react-native-community/async-storage';
import { useEffect, useState } from 'react';
import React from 'react';
import { Alert, Button, Picker, SectionList, StyleSheet, Text, View } from 'react-native';
import { ApiResponse, Service } from './shared';

const styles = StyleSheet.create({
  view: {
    display: 'flex'
  },
  container: {
    display: 'flex',
    margin: 10,
    marginTop: 50,
    backgroundColor: '#F5FCFF'
  },
  channel: {
    fontSize: 20,
    margin: 10
  }
});

const TARGET_DEVICE_STORAGE_KEY = 'targetDevice'
const storeTargetDevice = async (device: string) => {
  try {
    await AsyncStorage.setItem(TARGET_DEVICE_STORAGE_KEY, device)
  } catch (e) {
    Alert.alert(e.message || 'Error persisting target device')
  }
}

export const Channels = (props: {}) => {
  const [apiResponse, setApiResponse] = useState<{ type: 'loading' } | { type: 'ready', data: ApiResponse }>({ type: 'loading' })
  const [serviceStartup, setServiceStartup] = useState<{ type: 'loading', channel: string } | { type: 'idle' }>({ type: 'idle' })
  const [targetDevice, setTargetDevice] = useState<string | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(TARGET_DEVICE_STORAGE_KEY).then(setTargetDevice).catch(error => Alert.alert(error.message || 'Error reading target device from storage'))
  }, [])

  const onSelectTargetDevice = (device: string) => {
    storeTargetDevice(device)
    setTargetDevice(device)
  }

  useEffect(() => {
    fetch('http://192.168.1.249:3000', {
      method: 'GET'
    })
      .then((response) => response.json())
      .then((responseJson: ApiResponse) => {
        setApiResponse({ type: 'ready', data: responseJson })
      })
      .catch((error) => {
        console.error(error)
      });
  }, [])

  const loadChannel = async (service: string, channel: string) => {
    console.log('loadChannel', service, channel)
    try {
      setServiceStartup({ type: 'loading', channel })
      const response = await fetch(`http://192.168.1.249:3000/?service=${service}&channel=${channel}&targetDevice=${targetDevice}`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error()
      }
    } catch (error) {
      Alert.alert('Error while loading channel', error.message)
    }
    finally {
      setServiceStartup({ type: 'idle' })
    }
  }

  if (apiResponse.type === 'loading') {
    return <View><Text>loading...</Text></View>
  }

  return (
    <View style={styles.view}>
      <Picker
        selectedValue={targetDevice}
        onValueChange={(itemValue) =>
          onSelectTargetDevice(itemValue)
        }>
        {[<Picker.Item key={'empty'} label={''} value={''} />].concat(apiResponse.data.devices.map(device => <Picker.Item key={device} label={device} value={device} />))}
      </Picker>
      <View style={{height: '90%'}}>
        <SectionList
          style={styles.container}
          renderItem={({ item, index, section }) => 
            <Button disabled={!targetDevice || serviceStartup.type === 'loading' && serviceStartup.channel === item} title={item} key={index} onPress={() => {
              loadChannel(section.title, item)
            }} 
          />}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={{ fontWeight: 'bold' }}>{title}</Text>
          )}
          sections={apiResponse.data.services.map(service => ({ title: service.type, data: service.channels }))}
          keyExtractor={(item, index) => item + index}
        />
      </View>
    </View>
  )
}