import API from './api';

class MarksService {
  // Add or update marks
  static async addMarks(marksData) {
    try {
      const response = await API.post('/marks', marksData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: error.message };
    }
  }
  
  // Get marks by class
  static async getMarksByClass(classId, filters = {}) {
    try {
      const response = await API.get(`/marks/class/${classId}`, { params: filters });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: error.message };
    }
  }
  
  // Get marks by student
  static async getMarksByStudent(studentId, filters = {}) {
    try {
      const response = await API.get(`/marks/student/${studentId}`, { params: filters });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: error.message };
    }
  }
  
  // Get semester result
  static async getSemesterResult(studentId, semester, academicYear) {
    try {
      const response = await API.get(`/marks/result/${studentId}/semester/${semester}`, {
        params: { academicYear }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: error.message };
    }
  }
  
  // Get yearly result
  static async getYearlyResult(studentId, academicYear) {
    try {
      const response = await API.get(`/marks/result/${studentId}/yearly`, {
        params: { academicYear }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: error.message };
    }
  }
  
  // Get class ranking
  static async getClassRanking(classId, semester, academicYear) {
    try {
      const response = await API.get(`/marks/ranking/${classId}`, {
        params: { semester, academicYear }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: error.message };
    }
  }
  
  // Bulk upload marks
  static async bulkUploadMarks(marks) {
    try {
      const response = await API.post('/marks/bulk', { marks });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: error.message };
    }
  }
  
  // Delete marks (admin only)
  static async deleteMarks(markId) {
    try {
      const response = await API.delete(`/marks/${markId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: error.message };
    }
  }
}

export default MarksService;