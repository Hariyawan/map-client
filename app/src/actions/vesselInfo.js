import { SET_VESSEL_DETAILS, SET_VESSEL_TRACK } from '../actions';
import _ from 'lodash';
import VesselsTileData from '../components/Layers/VesselsTileData';
import PelagosClient from '../lib/pelagosClient';

export function setCurrentVessel(vesselDetails) {
  return (dispatch, getState) => {
    if (!vesselDetails) {
      dispatch({
        type: SET_VESSEL_DETAILS,
        payload: {}
      });
      return;
    }
    const state = getState();
    const token = state.user.token;
    const seriesGroup = vesselDetails.seriesgroup;
    let request;

    if (typeof XMLHttpRequest !== 'undefined') {
      request = new XMLHttpRequest();
    } else {
      throw new Error('XMLHttpRequest is disabled');
    }
    request.open(
      'GET',
      `${MAP_API_ENDPOINT}/v1/tilesets/tms-format-2015-2016-v1/sub/seriesgroup=${seriesGroup}/info`,
      true
    );
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.responseType = 'application/json';
    request.onreadystatechange = () => {
      if (request.readyState !== 4) {
        return;
      }
      const data = JSON.parse(request.responseText);
      delete data.series;
      dispatch({
        type: SET_VESSEL_DETAILS,
        payload: data
      });
    };
    request.send(null);
  };
}

export function getVesselTrack(seriesGroup, series = null) {
  return (dispatch, getState) => {
    const state = getState();
    const filters = state.filters;
    const startYear = new Date(filters.startDate).getUTCFullYear();
    const endYear = new Date(filters.endDate).getUTCFullYear();
    const urls = [];

    // TODO what's the point of loading all years?
    for (let i = startYear; i <= endYear; i++) {
      urls.push(`${MAP_API_ENDPOINT}/v1/tilesets/tms-format-2015-2016-v1/\
sub/seriesgroup=${seriesGroup}/${i}-01-01T00:00:00.000Z,${i + 1}-01-01T00:00:00.000Z;0,0,0`);
    }
    const promises = [];
    for (let urlIndex = 0, length = urls.length; urlIndex < length; urlIndex++) {
      promises.push(new PelagosClient().obtainTile(urls[urlIndex], state.user.token));
    }

    Promise.all(promises.map(p => p.catch(e => e)))
      .then(rawTileData => {
        const cleanData = VesselsTileData.getCleanVectorArrays(rawTileData);
        const groupedData = VesselsTileData.groupData(cleanData);
        // if (rawTileData[0]) {
          dispatch({
            type: SET_VESSEL_TRACK,
            payload: {
              seriesgroup: seriesGroup,
              seriesGroupData: groupedData,
              series: _.uniq(groupedData.series),
              selectedSeries: series
            }
          });
        // } else {
        //   dispatch({
        //     type: SET_VESSEL_TRACK,
        //     payload: null
        //   });
        // }
      });
  };
}
