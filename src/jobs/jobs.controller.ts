import { Body, Controller, Delete, Get, Optional, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public, ResponseMessage, User } from 'src/decorator/customize';
import { IUser } from 'src/users/users.interface';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) { }

  @Post()
  @ResponseMessage('create a new job successfully')
  // swagger
  @ApiBearerAuth('token')
  @ApiOperation({ summary: 'For create a job' })
  create(@Body() createJobDto: CreateJobDto, @User() user: IUser) {
    return this.jobsService.create(createJobDto, user);
  }

  @Public()
  @Get()
  @ResponseMessage('get all jobs successfully')
  // swagger
  @ApiOperation({ summary: 'For get jobs' })
  @ApiQuery({ name: 'current', required: false, type: Number, description: 'Current page', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Page size', example: 10 })
  @ApiQuery({
    type: 'string',
    name: 'filter',
    required: false,
    description: 'Filter',
    example: `{"name":"/eCommerce P/i","location":"/Hồ Ch/i","level":"/MIDDLE/i","salary":{"$gte":24000000,"$lte":25000000},"quantity":10,"skills":{"$in":["/NEST.J/i","ReactJs","Java"]}}`,
  })
  findAll(
    @Query('current') currentPage: string, // const currentPage: string = req.query.page
    @Query('pageSize') limit: string,
    @Query() queryString: string
  ) {
    return this.jobsService.findAll(+currentPage, +limit, queryString);
  }

  @Public()
  @Get(':id')
  @ResponseMessage('get a job successfully')
  // swagger
  @ApiOperation({ summary: 'For get a job information' })
  findOne(@Param('id') id: string, @Query() queryString: string) {
    let result = this.jobsService.findOne(id, queryString);
    return result;
  }

  @Patch(':id')
  @ResponseMessage('update a job successfully')
  // swagger
  @ApiBearerAuth('token')
  @ApiOperation({ summary: 'For update a job' })
  update(
    @Param('id') id: string,
    @Body() updateJobDto: UpdateJobDto,
    @User() user: IUser
  ) {
    return this.jobsService.update(id, updateJobDto, user);
  }

  @Delete(':id')
  @ResponseMessage('remove a job successfully')
  // swagger
  @ApiBearerAuth('token')
  @ApiOperation({ summary: 'For remove a job' })
  remove(
    @Param('id') id: string,
    @User() user: IUser) {
    return this.jobsService.remove(id, user);
  }

  // api get list user apply jobs
  @Get(':id/applied-users')
  @ResponseMessage("get users applied this job successfully")
  @ApiBearerAuth('token')
  @ApiOperation({ summary: 'For get users applied this job' })
  getAppliedUsers(@Param('id') id: string,
    @Query("current") currentPage: number,
    @Query("pageSize") limit: number,
    @Query() queryString: string
  ) {
    return this.jobsService.getAppliedUsers(id, queryString);
  }
}
