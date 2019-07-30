import React, {Component} from 'react';
import {SafeAreaView} from 'react-native';
import { Channels } from './Channels';


export default class App extends Component<{}> {
  render() {
    return <SafeAreaView><Channels /></SafeAreaView>
  }
}