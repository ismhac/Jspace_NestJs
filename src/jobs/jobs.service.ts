import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Job, JobDocument } from './schemas/job.schema';
import { IUser } from 'src/users/users.interface';
import mongoose from 'mongoose';
import aqp from 'api-query-params';
import { DatabasesService } from 'src/databases/databases.service';
import { Resume, ResumeDocument } from 'src/resumes/schemas/resume.schema';
import { Company, CompanyDocument } from 'src/companies/schemas/company.schema';
import { ErrorConstants } from 'src/utils/ErrorConstants';
import { User, UserDocument } from 'src/users/schemas/user.schema';
import { notStrictEqual } from 'assert';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name)
    private jobModel: SoftDeleteModel<JobDocument>,

    @InjectModel(User.name)
    private userModel: SoftDeleteModel<UserDocument>,

    @InjectModel(Resume.name)
    private resumeModel: SoftDeleteModel<ResumeDocument>,

    @InjectModel(Company.name)
    private companyModel: SoftDeleteModel<CompanyDocument>
  ) { }

  private readonly logger = new Logger(DatabasesService.name);


  async getAppliedUsers(jobId: string, queryString: string) {

    let { filter } = aqp(queryString);
    filter.current = filter.current ? filter.current : 1;
    filter.pageSize = filter.pageSize ? filter.pageSize : 10;


    // const users = await this.userModel.find(
    //   { appliedJobs: { $in: [jobId] } })
    //   .select({ appliedJobs: 1, name: 1, _id: 1 })
    //   .populate({ path: "job", select: { _id: 1 } })



    let appliedUsers = await this.resumeModel.find({ job: jobId })
      .populate([
        {
          path: "user",
          select: { name: 1, _id: 1 },
          match: { appliedJobs: { $in: [jobId] } }
        }
      ])
      .select({ "job": 1, "email": 1, "file": 1, "status": 1, "createdAt": 1 });

    appliedUsers = appliedUsers.filter(doc => doc.user != null);
    const totalItems = appliedUsers.length;
    const totalPages = Math.ceil(totalItems / filter.pageSize);
    const offset = (+filter.current - 1) * (+filter.pageSize);
    const defaultLimit = +filter.pageSize ? +filter.pageSize : 10;

    return {
      meta: {
        current: filter.current,
        pageSize: filter.pageSize,
        pages: totalPages,
        total: totalItems
      },
      results: appliedUsers.slice(offset, offset + defaultLimit)
    }
  }

  async create(createJobDto: CreateJobDto, user: IUser) {
    const {
      name, skills, company, location, salary,
      quantity, level, description, startDate, endDate, isActive
    } = createJobDto;

    // check company is exist
    try {
      let isExistCompany = await this.companyModel.exists({ _id: company });
    } catch (error) {
      throw new BadRequestException(ErrorConstants.NOT_FOUND_COMPANY_ID(company))
    }

    return await this.jobModel.create({
      name: name,
      skills: skills,
      company: company,
      location: location,
      salary: salary,
      quantity: quantity,
      level: level,
      description: description,
      startDate: startDate,
      endDate: endDate,
      isActive: isActive,
      createdBy: {
        _id: user._id,
        email: user.email
      }
    });
  }

  convertStringToRegExp(filter) {
    for (let key in filter) {
      if (typeof filter[key] === 'string') {
        if (filter[key] === '' || filter[key] === '//i') {
          delete filter[key];
        } else {
          let match = filter[key].match(new RegExp('^/(.*?)/([gimy]*)$'));
          if (match) {
            filter[key] = new RegExp(match[1], match[2]);
          }
        }
      } else if (Array.isArray(filter[key])) {
        filter[key] = filter[key].filter(value => value !== '' && value !== '//i').map(value => {
          if (typeof value === 'string') {
            let match = value.match(new RegExp('^/(.*?)/([gimy]*)$'));
            if (match) {
              return new RegExp(match[1], match[2]);
            }
          }
          return value;
        });
        if (filter[key].length === 0) {
          delete filter[key];
        }
      } else if (typeof filter[key] === 'object') {
        if (Object.keys(filter[key]).length === 0 ||
          ('$gte' in filter[key] && (filter[key]['$gte'] === '' || filter[key]['$gte'] === undefined)) ||
          ('$lte' in filter[key] && (filter[key]['$lte'] === '' || filter[key]['$lte'] === undefined)) ||
          ('$in' in filter[key] && (filter[key]['$in'].length === 0))) {
          delete filter[key];
        } else {
          this.convertStringToRegExp(filter[key]);
        }
      }
    }
  }

  async findAll(currentPage: number, limit: number, queryString: string) {
    let { filter, sort, population } = aqp(queryString);

    if (!filter.userId) {
      delete filter.current;
      delete filter.pageSize;

      this.convertStringToRegExp(filter);
      // this.logger.log(filter);
      let offset = (+currentPage - 1) * (+limit);
      let defaultLimit = +limit ? +limit : 10;

      const totalItems = (await this.jobModel.find(filter)).length;
      const totalPages = Math.ceil(totalItems / defaultLimit);
      const results = await this.jobModel.find(filter)
        .skip(offset)
        .limit(defaultLimit)
        .sort(sort as any)
        .populate(
          {
            path: "company",
            select: { logo: 1, name: 1 }
          }
        )
        .select({ name: 1, skills: 1, salary: 1, level: 1, location: 1, startDate: 1, endDate: 1, appliedUsers: 1, isActive: 1 })
        .exec();

      let finalResult = await Promise.all(results.map(async (result) => {
        return { job: result, checkApplied: false, checkLiked: false };
      }))

      return {
        meta: {
          current: currentPage,
          pageSize: limit,
          pages: totalPages,
          total: totalItems
        },
        results: finalResult
      }
    } else {
      delete filter.current;
      delete filter.pageSize;

      let userId = filter.userId;

      delete filter.userId;

      this.convertStringToRegExp(filter);
      // this.logger.log(filter);
      let offset = (+currentPage - 1) * (+limit);
      let defaultLimit = +limit ? +limit : 10;

      const totalItems_1 = (await this.jobModel.find(filter)).length;
      const totalPages_1 = Math.ceil(totalItems_1 / defaultLimit);
      const results = await this.jobModel.find(filter)
        .skip(offset)
        .limit(defaultLimit)
        .sort(sort as any)
        .populate(
          {
            path: "company",
            select: { logo: 1, name: 1 }
          }
        )
        .select({ name: 1, skills: 1, salary: 1, level: 1, location: 1, startDate: 1, endDate: 1, appliedUsers: 1, isActive: 1 })
        .exec();

      let finalResult = await Promise.all(results.map(async (result) => {
        let checkApplied = false;
        let checkLiked = false;
        let userApplied = await this.userModel.find({
          $and: [
            { _id: userId },
            { appliedJobs: { $in: [result._id] } }
          ]
        })

        let userLiked = await this.userModel.find({
          $and: [
            { _id: userId },
            { likeJobs: { $in: [result._id] } }
          ]
        })

        if (userApplied.length > 0) checkApplied = true;
        if (userLiked.length > 0) checkLiked = true;
        return { job: result, checkApplied: checkApplied, checkLiked: checkLiked };
      }))
      return {
        meta: {
          current: currentPage,
          pageSize: limit,
          pages: totalPages_1,
          total: totalItems_1
        },
        results: finalResult
      }
    }
  }

  async findOne(id: string, queryString: string) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestException(ErrorConstants.NOT_FOUND_JOB_ID)
      }

      const { filter } = aqp(queryString)

      if (!filter.userId) {
        let job = await this.jobModel.findById(id)
          .populate({
            path: "company",
            select: { name: 1, logo: 1 }
          });

        return { job: job, checkApplied: false, checkLiked: false };
      } else {

        let checkApplied = false;
        let checkLiked = false;

        let userApplied = await this.userModel.find({
          $and: [
            { _id: filter.userId },
            { appliedJobs: { $in: [id] } }
          ]
        })

        let userLiked = await this.userModel.find({
          $and: [
            { _id: filter.userId },
            { likeJobs: { $in: [id] } }
          ]
        })

        let job = await this.jobModel.findById(id)
          .populate({
            path: "company",
            select: { name: 1, logo: 1 }
          });

        if (userApplied.length > 0) checkApplied = true;
        if (userLiked.length > 0) checkLiked = true;
        return { job: job, checkApplied: checkApplied, checkLiked: checkLiked };
      }



    } catch (error) {
      throw new BadRequestException(ErrorConstants.NOT_FOUND_JOB_ID(id))
    }
  }

  async update(id: string, updateJobDto: UpdateJobDto, user: IUser) {
    return await this.jobModel.updateOne(
      { _id: id },
      {
        ...updateJobDto,
        updatedBy: {
          _id: user._id,
          email: user.email
        }
      }
    )
  }

  async remove(id: string, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return 'not found job';
    }

    await this.jobModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email
        }
      }
    )

    return this.jobModel.softDelete({ _id: id });
  }
}
