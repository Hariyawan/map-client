import uniq from 'lodash/uniq';
import { LAYER_TYPES_WITH_HEADER } from 'constants';
import { fitTimelineToTrack } from 'filters/filtersActions';
import { trackSearchResultClicked, trackVesselPointClicked } from 'analytics/analyticsActions';
import {
  getTilePromises,
  getCleanVectorArrays,
  groupData,
  addTracksPointsRenderingData,
  getTracksPlaybackData
} from 'utils/heatmapTileData';
import { addVesselToRecentVesselList } from 'recentVessels/recentVesselsActions';
import { fitBoundsToTrack } from 'map/mapViewportActions';
import getVesselName from 'utils/getVesselName';
import buildEndpoint from 'utils/buildEndpoint';

export const ADD_VESSEL = 'ADD_VESSEL';
export const SET_VESSEL_DETAILS = 'SET_VESSEL_DETAILS';
export const SHOW_VESSEL_DETAILS = 'SHOW_VESSEL_DETAILS';
export const SET_VESSEL_TRACK = 'SET_VESSEL_TRACK';
export const CLEAR_VESSEL_INFO = 'CLEAR_VESSEL_INFO';
export const HIDE_VESSELS_INFO_PANEL = 'HIDE_VESSELS_INFO_PANEL';
export const TOGGLE_VESSEL_PIN = 'TOGGLE_VESSEL_PIN';
export const SET_PINNED_VESSEL_COLOR = 'SET_PINNED_VESSEL_COLOR';
export const SET_PINNED_VESSEL_TITLE = 'SET_PINNED_VESSEL_TITLE';
export const LOAD_PINNED_VESSEL = 'LOAD_PINNED_VESSEL';
export const TOGGLE_PINNED_VESSEL_EDIT_MODE = 'TOGGLE_PINNED_VESSEL_EDIT_MODE';
export const SET_PINNED_VESSEL_TRACK_VISIBILITY = 'SET_PINNED_VESSEL_TRACK_VISIBILITY';


function showVesselDetails(tilesetId, seriesgroup) {
  return {
    type: SHOW_VESSEL_DETAILS,
    payload: {
      seriesgroup,
      tilesetId
    }
  };
}

function setCurrentVessel(tilesetId, seriesgroup, fromSearch) {
  return (dispatch, getState) => {
    const state = getState();
    const token = state.user.token;
    let request;

    if (typeof XMLHttpRequest !== 'undefined') {
      request = new XMLHttpRequest();
    } else {
      throw new Error('XMLHttpRequest is disabled');
    }

    const layer = state.layers.workspaceLayers.find(l =>
      LAYER_TYPES_WITH_HEADER.indexOf(l.type) > -1 && l.tilesetId === tilesetId);

    request.open(
      'GET',
      buildEndpoint(layer.header.endpoints.info, { id: seriesgroup }),
      true
    );
    if (token) {
      request.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    request.setRequestHeader('Accept', 'application/json');
    request.onreadystatechange = () => {
      if (request.readyState !== 4) {
        return;
      }
      if (request.status >= 500 || request.status === 404) {
        console.error('Error loading vessel info:', request.responseText);
        return;
      }
      const data = JSON.parse(request.responseText);
      delete data.series;

      data.tilesetId = tilesetId;

      dispatch({
        type: SET_VESSEL_DETAILS,
        payload: {
          vesselData: data,
          layer
        }
      });
      dispatch(showVesselDetails(tilesetId, seriesgroup));

      if (fromSearch) {
        dispatch(trackSearchResultClicked(tilesetId, seriesgroup));
      } else {
        dispatch(trackVesselPointClicked(tilesetId, seriesgroup));
      }

      dispatch(addVesselToRecentVesselList(data.seriesgroup, getVesselName(data, layer.header.info.fields), tilesetId));
    };
    request.send(null);
  };
}

function _getTrackTimeExtent(data, series = null) {
  let start = Infinity;
  let end = 0;
  for (let i = 0, length = data.datetime.length; i < length; i++) {
    if (series !== null && series !== data.series[i]) {
      continue;
    }
    const time = data.datetime[i];
    if (time < start) {
      start = time;
    } else if (time > end) {
      end = time;
    }
  }
  return [start, end];
}

export function getVesselTrack({ tilesetId, seriesgroup, series, zoomToBounds, updateTimelineBounds }) {
  return (dispatch, getState) => {
    const state = getState();

    const currentLayer = state.layers.workspaceLayers.find(layer => layer.tilesetId === tilesetId);
    if (!currentLayer) {
      console.warn('trying to get a vessel track on a layer that doesn\'t exist', state.layers.workspaceLayers);
      return;
    }
    const header = currentLayer.header;
    const url = header.endpoints.tracks;
    const promises = getTilePromises(url, state.user.token, header.temporalExtents, { seriesgroup });

    Promise.all(promises.map(p => p.catch(e => e)))
      .then((rawTileData) => {
        const cleanData = getCleanVectorArrays(rawTileData);

        if (!cleanData.length) {
          return;
        }
        const groupedData = groupData(cleanData, [
          'latitude',
          'longitude',
          'datetime',
          'series',
          'weight',
          'sigma'
        ]);

        const vectorArray = addTracksPointsRenderingData(groupedData);

        dispatch({
          type: SET_VESSEL_TRACK,
          payload: {
            seriesgroup,
            data: getTracksPlaybackData(vectorArray),
            series: uniq(groupedData.series),
            selectedSeries: series
          }
        });

        if (updateTimelineBounds === true) {
          const tracksExtent = _getTrackTimeExtent(groupedData, series);
          dispatch(fitTimelineToTrack(tracksExtent));
        }

        if (zoomToBounds) {
          dispatch(fitBoundsToTrack(groupedData));
        }
      });
  };
}

export function setPinnedVesselColor(seriesgroup, color) {
  return {
    type: SET_PINNED_VESSEL_COLOR,
    payload: {
      seriesgroup,
      color
    }
  };
}

export function setPinnedVesselTitle(seriesgroup, title) {
  return {
    type: SET_PINNED_VESSEL_TITLE,
    payload: {
      seriesgroup,
      title
    }
  };
}

export function togglePinnedVesselVisibility(seriesgroup, forceStatus = null) {
  return (dispatch, getState) => {
    const currentVessel = getState().vesselInfo.vessels.find(vessel => vessel.seriesgroup === seriesgroup);
    if (currentVessel) {
      const visible = (forceStatus !== null) ? forceStatus : !currentVessel.visible;
      dispatch({
        type: SET_PINNED_VESSEL_TRACK_VISIBILITY,
        payload: {
          seriesgroup,
          visible
        }
      });
      if (visible === true && currentVessel.track === undefined) {
        dispatch(getVesselTrack({
          tilesetId: currentVessel.tilesetId,
          seriesgroup,
          series: null,
          zoomToBounds: false,
          updateTimelineBounds: false
        }));
      }
    }
  };
}

const applyFleetOverridesForVessel = (seriesgroup, fleet) => (dispatch) => {
  dispatch(togglePinnedVesselVisibility(seriesgroup, fleet.visible));
  dispatch(setPinnedVesselColor(seriesgroup, fleet.color));
};

export const applyFleetOverrides = () => (dispatch, getState) => {
  const fleets = getState().fleets.fleets;
  const currentVesselsSeriesgroups = getState().vesselInfo.vessels.map(v => v.seriesgroup);
  fleets.forEach((fleet) => {
    fleet.vessels.forEach((fleetVessel) => {
      if (currentVesselsSeriesgroups.indexOf(fleetVessel) > -1) {
        dispatch(applyFleetOverridesForVessel(fleetVessel, fleet));
      }
    });
  });
};

export function setPinnedVessels(pinnedVessels) {
  return (dispatch, getState) => {
    const state = getState();
    const options = {
      Accept: '*/*'
    };

    options.headers = {
      Authorization: `Bearer ${state.user.token}`
    };

    pinnedVessels.forEach((pinnedVessel) => {
      let request;

      if (typeof XMLHttpRequest !== 'undefined') {
        request = new XMLHttpRequest();
      } else {
        throw new Error('XMLHttpRequest is disabled');
      }

      const layer = state.layers.workspaceLayers.find(l => l.tilesetId === pinnedVessel.tilesetId);
      if (layer === undefined) {
        console.warn('Trying to load a pinned vessel but the layer seems to be absent on the workspace', pinnedVessel);
        return;
      }

      request.open(
        'GET',
        buildEndpoint(layer.header.endpoints.info, { id: pinnedVessel.seriesgroup }),
        true
      );
      if (state.user.token) {
        request.setRequestHeader('Authorization', `Bearer ${state.user.token}`);
      }
      request.setRequestHeader('Accept', 'application/json');
      request.onreadystatechange = () => {
        if (request.readyState !== 4) {
          return;
        }
        if (request.status === 404) {
          console.warn('Error:', request.responseText);
          return;
        }
        const data = JSON.parse(request.responseText);
        delete data.series;
        dispatch({
          type: LOAD_PINNED_VESSEL,
          payload: Object.assign({}, pinnedVessel, data)
        });

        const fleets = getState().fleets.fleets;
        const parentFleet = fleets.find(f => f.vessels.indexOf(pinnedVessel.seriesgroup) > -1);
        if (parentFleet) {
          dispatch(applyFleetOverridesForVessel(pinnedVessel.seriesgroup, parentFleet));
        } else {
          dispatch(togglePinnedVesselVisibility(pinnedVessel.seriesgroup, pinnedVessel.visible === true));
        }

        dispatch(addVesselToRecentVesselList(
          pinnedVessel.seriesgroup,
          getVesselName(pinnedVessel, layer.header.info.fields),
          pinnedVessel.tilesetId
        ));
      };
      request.send(null);
    });
  };
}

export function hideVesselsInfoPanel() {
  return {
    type: HIDE_VESSELS_INFO_PANEL
  };
}

export function addVessel(tilesetId, seriesgroup, series = null, zoomToBounds = false, fromSearch = false, parentEncounter = null) {
  return (dispatch, getState) => {
    const state = getState();
    dispatch({
      type: ADD_VESSEL,
      payload: {
        seriesgroup,
        series,
        tilesetId,
        parentEncounter
      }
    });
    if (state.user.userPermissions !== null && state.user.userPermissions.indexOf('seeVesselBasicInfo') > -1) {
      dispatch(setCurrentVessel(tilesetId, seriesgroup, fromSearch));
    } else {
      dispatch(hideVesselsInfoPanel());
    }
    dispatch(getVesselTrack({
      tilesetId,
      seriesgroup,
      series,
      zoomToBounds,
      updateTimelineBounds: fromSearch === true
    }));
  };
}

export function addVesselFromEncounter(tilesetId, seriesgroup) {
  return (dispatch, getState) => {
    const state = getState();
    const encounter = {
      seriesgroup: state.encounters.seriesgroup,
      tilesetId: state.encounters.tilesetId
    };
    dispatch(addVessel(tilesetId, seriesgroup, null, false, false, encounter));
  };
}

export function clearVesselInfo() {
  return {
    type: CLEAR_VESSEL_INFO
  };
}

function _getPinAction(state, seriesgroup) {
  const vesselIndex = state.vesselInfo.vessels.findIndex(vessel => vessel.seriesgroup === seriesgroup);
  const vessel = state.vesselInfo.vessels[vesselIndex];
  const pinned = !vessel.pinned;

  let visible = false;

  // when pinning the vessel currently in info panel, should be initially visible
  if (pinned === true) {
    visible = true;
  }
  return {
    type: TOGGLE_VESSEL_PIN,
    payload: {
      vesselIndex,
      pinned,
      visible,
      seriesgroup: vessel.seriesgroup,
      vesselname: vessel.vesselname,
      tilesetId: vessel.layerId
    }
  };
}

export function toggleActiveVesselPin(seriesgroup) {
  return (dispatch, getState) => {
    dispatch(_getPinAction(getState(), seriesgroup));
  };
}

export function toggleVesselPin(seriesgroup) {
  return (dispatch, getState) => {
    dispatch(_getPinAction(getState(), seriesgroup));
  };
}

export function togglePinnedVesselEditMode(forceMode = null) {
  return {
    type: TOGGLE_PINNED_VESSEL_EDIT_MODE,
    payload: {
      forceMode
    }
  };
}

export function showPinnedVesselDetails(tilesetId, seriesgroup) {
  return (dispatch) => {
    dispatch(showVesselDetails(tilesetId, seriesgroup));
    dispatch(togglePinnedVesselVisibility(seriesgroup, true));
  };
}

