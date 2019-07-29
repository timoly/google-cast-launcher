// tslint:disable:no-console
import AsyncStorage from '@react-native-community/async-storage';
import { useEffect, useState } from 'react';
import React from 'react';
import { Alert, Button, DeviceEventEmitter, Picker, SectionList, StyleSheet, Text, View } from 'react-native';
import QuickActions from 'react-native-quick-actions';
import { ApiResponse } from './shared';

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

const loadChannel = async (service: string, targetDevice: string, channel: string, setServiceStartup: (data: ServiceStartup) => void) => {
  console.log('loadChannel', service, channel)
  try {
    setServiceStartup({ type: 'loading', channel })
    const response = await fetch(`http://192.168.1.249:3000/?service=${service}&channel=${encodeURIComponent(channel)}&targetDevice=${targetDevice}`, {
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

const getDefaultTargetDevice = () => {
  return AsyncStorage
      .getItem(TARGET_DEVICE_STORAGE_KEY)
      .catch(error => Alert.alert(error.message || 'Error reading target device from storage'))
}

const onQuickAction = async (data: any) => {
  console.log('onQuickAction', data)
  const targetDevice = await getDefaultTargetDevice()
  if (data && data.title && data.userInfo && data.userInfo.service && targetDevice) {
    loadChannel(data.userInfo.service, targetDevice, data.title, () => {
      // NOOP
    })
  }
}

QuickActions.popInitialAction()
  .then(onQuickAction)
  .catch(console.error);

type ServiceStartup = { type: 'loading', channel: string } | { type: 'idle' }

export const Channels = (props: {}) => {
  const [apiResponse, setApiResponse] = useState<{ type: 'loading' } | { type: 'ready', data: ApiResponse }>({ type: 'loading' })
  const [serviceStartup, setServiceStartup] = useState<ServiceStartup>({ type: 'idle' })
  const [targetDevice, setTargetDevice] = useState<string | null>(null)

  useEffect(() => {
    getDefaultTargetDevice().then(device => {
      if(device){
        setTargetDevice(device)
      }
    })

    DeviceEventEmitter.addListener('quickActionShortcut', onQuickAction);
  }, [])

  useEffect(() => {
    if (!targetDevice && apiResponse.type === 'ready' && apiResponse.data.devices.length > 0) {
      setTargetDevice(apiResponse.data.devices[0])
    }

    // if (!targetDevice && apiResponse.type === 'ready' && apiResponse.data.services.length > 0) {
    //   QuickActions.setShortcutItems([
    //     {
    //       type: 'Channels',
    //       title: 'TV channels',
    //       subtitle: 'Watch tv',
    //       icon: 'Play',
    //       userInfo: {
    //         url: 'app://orders' // Provide any custom data like deep linking URL
    //       }
    //     }
    //   ])
    // }
  }, [apiResponse])

  useEffect(() => {
    if (targetDevice) {
      storeTargetDevice(targetDevice)
    }
  }, [targetDevice])

  const onSelectTargetDevice = (device: string) => {

    setTargetDevice(device)
  }

  useEffect(() => {
    fetch('http://192.168.1.249:3000', {
      method: 'GET'
    })
      .then((response) => response.json())
      .then((responseJson: ApiResponse) => {
        console.log(responseJson)
        setApiResponse({ type: 'ready', data: responseJson })
      })
      .catch((error) => {
        console.error(error)
      });
  }, [])

  if (apiResponse.type === 'loading') {
    return <View><Text>loading...</Text></View>
  }

  return (
    <View style={styles.view}>
      <Picker
        itemStyle={{ height: 44 }}
        selectedValue={targetDevice}
        onValueChange={(itemValue) =>
          onSelectTargetDevice(itemValue)
        }>
        {[<Picker.Item key={'empty'} label={''} value={''} />].concat(apiResponse.data.devices.map(device => <Picker.Item key={device} label={device} value={device} />))}
      </Picker>
      <View style={{ height: '90%' }}>
        <SectionList
          style={styles.container}
          renderItem={({ item, index, section }) =>
            <Button disabled={!targetDevice || serviceStartup.type === 'loading' && serviceStartup.channel === item} title={item} key={index} onPress={() => {
              loadChannel(section.title, targetDevice!, item, setServiceStartup)
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